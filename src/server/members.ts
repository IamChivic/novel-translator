import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { defaultTerms, members, terms, threads } from "@/db/schema";
import {
  FONT_FAMILIES,
  GENDERS,
  READING_WIDTHS,
  TEXT_SIZES,
} from "@/shared/options";

export interface Identity {
  id: string;
  email: string;
}

/** The member's own record, made the first time they're seen. */
export async function ensureMember(user: Identity) {
  await db
    .insert(members)
    .values({ userId: user.id, email: user.email })
    .onConflictDoUpdate({
      target: members.userId,
      set: { email: user.email },
      setWhere: sql`${members.email} <> ${user.email}`,
    });
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.userId, user.id));
  return member!;
}

export async function getPreferences(user: Identity) {
  const member = await ensureMember(user);
  return {
    defaultInstruction: member.defaultInstruction,
    findNewTerms: member.findNewTerms,
    liveTermUpdates: member.liveTermUpdates,
    textSize: member.textSize as (typeof TEXT_SIZES)[number],
    readingWidth: member.readingWidth as (typeof READING_WIDTHS)[number],
    fontFamily: member.fontFamily as (typeof FONT_FAMILIES)[number],
  };
}
export type Preferences = Awaited<ReturnType<typeof getPreferences>>;

export const updatePreferencesInput = z
  .object({
    defaultInstruction: z.string().max(4000).optional(),
    findNewTerms: z.boolean().optional(),
    liveTermUpdates: z.boolean().optional(),
    textSize: z.enum(TEXT_SIZES).optional(),
    readingWidth: z.enum(READING_WIDTHS).optional(),
    fontFamily: z.enum(FONT_FAMILIES).optional(),
  })
  .strict();

export async function updatePreferences(
  user: Identity,
  change: z.infer<typeof updatePreferencesInput>,
) {
  await ensureMember(user);
  if (Object.keys(change).length > 0) {
    await db.update(members).set(change).where(eq(members.userId, user.id));
  }
  return getPreferences(user);
}

export const termFields = {
  original: z.string().trim().min(1, "Enter the original term").max(100),
  translation: z.string().trim().min(1, "Enter a translation").max(200),
  gender: z.enum(GENDERS).default("none"),
  note: z.string().trim().max(500).default(""),
  alwaysUse: z.boolean().default(false),
};

export const saveDefaultTermInput = z
  .object({ id: z.string().optional(), ...termFields })
  .strict();
export const deleteDefaultTermInput = z.object({ id: z.string() }).strict();

export function listDefaultTerms(userId: string) {
  return db
    .select({
      id: defaultTerms.id,
      original: defaultTerms.original,
      translation: defaultTerms.translation,
      gender: defaultTerms.gender,
      note: defaultTerms.note,
      alwaysUse: defaultTerms.alwaysUse,
    })
    .from(defaultTerms)
    .where(eq(defaultTerms.userId, userId))
    .orderBy(asc(defaultTerms.original));
}

/**
 * Saves a default term (new, or by id or original), then puts it in place
 * of the model's own wording in every thread of the member's that has an
 * auto term with the same original. Terms the member set stay.
 */
export async function saveDefaultTerm(
  userId: string,
  input: z.infer<typeof saveDefaultTermInput>,
) {
  const { id, ...fields } = input;
  if (id) {
    const [updated] = await db
      .update(defaultTerms)
      .set(fields)
      .where(and(eq(defaultTerms.id, id), eq(defaultTerms.userId, userId)))
      .returning({ id: defaultTerms.id });
    if (!updated) throw new Error("Default term not found");
  } else {
    await db
      .insert(defaultTerms)
      .values({ id: crypto.randomUUID(), userId, ...fields })
      .onConflictDoUpdate({
        target: [defaultTerms.userId, defaultTerms.original],
        set: fields,
      });
  }
  const owned = db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.userId, userId));
  await db
    .update(terms)
    .set({
      translation: fields.translation,
      gender: fields.gender,
      note: fields.note,
      alwaysUse: fields.alwaysUse,
      source: "default",
    })
    .where(
      and(
        eq(terms.userId, userId),
        inArray(terms.threadId, owned),
        eq(terms.original, fields.original),
        eq(terms.source, "auto"),
      ),
    );
}

export async function deleteDefaultTerm(userId: string, id: string) {
  const [deleted] = await db
    .delete(defaultTerms)
    .where(and(eq(defaultTerms.id, id), eq(defaultTerms.userId, userId)))
    .returning({ id: defaultTerms.id });
  if (!deleted) throw new Error("Default term not found");
}

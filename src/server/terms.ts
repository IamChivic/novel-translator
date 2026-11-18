import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { terms } from "@/db/schema";
import type { Gender, TermSource } from "@/shared/options";
import { saveDefaultTerm, termFields } from "./members";
import { NotFoundError, requireThread } from "./threads";

export async function listTerms(userId: string, threadId: string) {
  await requireThread(userId, threadId);
  const rows = await db
    .select({
      id: terms.id,
      original: terms.original,
      translation: terms.translation,
      autoTranslation: terms.autoTranslation,
      gender: terms.gender,
      note: terms.note,
      alwaysUse: terms.alwaysUse,
      excluded: terms.excluded,
      source: terms.source,
    })
    .from(terms)
    .where(and(eq(terms.threadId, threadId), eq(terms.userId, userId)))
    .orderBy(asc(terms.createdAt), asc(terms.original));
  return rows.map((row) => ({
    ...row,
    gender: row.gender as Gender,
    source: row.source as TermSource,
  }));
}

async function requireTerm(userId: string, id: string) {
  const [term] = await db
    .select()
    .from(terms)
    .where(and(eq(terms.id, id), eq(terms.userId, userId)));
  if (!term) throw new NotFoundError("Term not found");
  return term;
}

export const saveTermInput = z
  .object({ threadId: z.string(), id: z.string().optional(), ...termFields })
  .strict();

/** Adds or edits a thread term. Whatever the member saves is theirs: source "user". */
export async function saveTerm(userId: string, input: z.infer<typeof saveTermInput>) {
  const { threadId, id, ...fields } = input;
  await requireThread(userId, threadId);
  if (id) {
    const term = await requireTerm(userId, id);
    if (term.threadId !== threadId) throw new NotFoundError("Term not found");
    const clash = await db
      .select({ id: terms.id })
      .from(terms)
      .where(and(eq(terms.threadId, threadId), eq(terms.original, fields.original)));
    if (clash.some((row) => row.id !== id)) throw new Error("That term is already in the glossary");
    await db
      .update(terms)
      .set({ ...fields, source: "user" })
      .where(and(eq(terms.id, id), eq(terms.userId, userId)));
    return;
  }
  await db
    .insert(terms)
    .values({ id: crypto.randomUUID(), threadId, userId, ...fields, source: "user" })
    .onConflictDoUpdate({
      target: [terms.threadId, terms.original],
      set: { ...fields, source: "user" },
    });
}

export const termIdInput = z.object({ id: z.string() }).strict();
export const excludeTermInput = z.object({ id: z.string(), excluded: z.boolean() }).strict();

export async function setExcluded(userId: string, id: string, excluded: boolean) {
  await requireTerm(userId, id);
  await db.update(terms).set({ excluded }).where(and(eq(terms.id, id), eq(terms.userId, userId)));
}

/** Back to the model's wording, when it proposed one. */
export async function resetToAuto(userId: string, id: string) {
  const term = await requireTerm(userId, id);
  if (!term.autoTranslation) throw new Error("This term has no automatic translation");
  await db
    .update(terms)
    .set({ translation: term.autoTranslation, source: "auto" })
    .where(and(eq(terms.id, id), eq(terms.userId, userId)));
}

export async function deleteTerm(userId: string, id: string) {
  await requireTerm(userId, id);
  await db.delete(terms).where(and(eq(terms.id, id), eq(terms.userId, userId)));
}

/** Saves a thread term as one of the member's defaults (new, or updating the one with its original). */
export async function addToDefaults(userId: string, id: string) {
  const term = await requireTerm(userId, id);
  await saveDefaultTerm(userId, {
    original: term.original,
    translation: term.translation,
    gender: term.gender as Gender,
    note: term.note,
    alwaysUse: term.alwaysUse,
  });
}

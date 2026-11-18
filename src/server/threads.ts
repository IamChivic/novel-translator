import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chapters, members, terms, threads } from "@/db/schema";
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  THREAD_STATUSES,
  type ThreadStatus,
} from "@/shared/options";

export class NotFoundError extends Error {
  constructor(what = "Not found") {
    super(what);
    this.name = "NotFoundError";
  }
}

export function parseTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

/** The thread when this member owns it. */
export async function ownedThread(userId: string, threadId: string) {
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
  return thread ?? null;
}

export async function requireThread(userId: string, threadId: string) {
  const thread = await ownedThread(userId, threadId);
  if (!thread) throw new NotFoundError("Thread not found");
  return thread;
}

export async function listThreads(userId: string) {
  const rows = await db
    .select({
      id: threads.id,
      name: threads.name,
      status: threads.status,
      tags: threads.tags,
      createdAt: threads.createdAt,
      lastTranslatedAt: threads.lastTranslatedAt,
      chapterCount: sql<number>`(select count(*) from ${chapters} where ${chapters.threadId} = ${threads.id})`,
    })
    .from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(desc(threads.createdAt));
  return rows.map((row) => ({
    ...row,
    status: row.status as ThreadStatus,
    tags: parseTags(row.tags),
  }));
}

const tagList = z
  .array(z.string().trim().min(1).max(MAX_TAG_LENGTH, `Tags are at most ${MAX_TAG_LENGTH} characters`))
  .max(MAX_TAGS, `At most ${MAX_TAGS} tags`)
  .transform((tags) => [...new Set(tags)]);

export const createThreadInput = z
  .object({ name: z.string().trim().min(1, "Enter a name").max(200) })
  .strict();

export async function createThread(userId: string, name: string) {
  const [thread] = await db
    .insert(threads)
    .values({ id: crypto.randomUUID(), userId, name })
    .returning({ id: threads.id });
  return thread!;
}

export const updateThreadInput = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, "Enter a name").max(200).optional(),
    status: z.enum(THREAD_STATUSES).optional(),
    tags: tagList.optional(),
    note: z.string().max(5000).optional(),
  })
  .strict();

export async function updateThread(
  userId: string,
  { id, tags, ...change }: z.infer<typeof updateThreadInput>,
) {
  const [updated] = await db
    .update(threads)
    .set({ ...change, ...(tags ? { tags: JSON.stringify(tags) } : {}) })
    .where(and(eq(threads.id, id), eq(threads.userId, userId)))
    .returning({ id: threads.id });
  if (!updated) throw new NotFoundError("Thread not found");
}

export const setInstructionInput = z
  .object({ id: z.string(), instruction: z.string().max(4000).nullable() })
  .strict();

/** A thread's own instruction, or null to use the member's default again. */
export async function setInstruction(
  userId: string,
  { id, instruction }: z.infer<typeof setInstructionInput>,
) {
  const [updated] = await db
    .update(threads)
    .set({ instruction })
    .where(and(eq(threads.id, id), eq(threads.userId, userId)))
    .returning({ id: threads.id });
  if (!updated) throw new NotFoundError("Thread not found");
}

export const threadIdInput = z.object({ id: z.string() }).strict();

/** Deletes the thread with its chapters, glossary and share link. */
export async function deleteThread(userId: string, id: string) {
  await requireThread(userId, id);
  await db.batch([
    db.delete(chapters).where(and(eq(chapters.threadId, id), eq(chapters.userId, userId))),
    db.delete(terms).where(and(eq(terms.threadId, id), eq(terms.userId, userId))),
    db.delete(threads).where(and(eq(threads.id, id), eq(threads.userId, userId))),
  ]);
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createShareLink(userId: string, id: string) {
  const thread = await requireThread(userId, id);
  if (thread.shareToken) return thread.shareToken;
  const token = newToken();
  await db
    .update(threads)
    .set({ shareToken: token })
    .where(and(eq(threads.id, id), eq(threads.userId, userId)));
  return token;
}

export async function revokeShareLink(userId: string, id: string) {
  await requireThread(userId, id);
  await db
    .update(threads)
    .set({ shareToken: null })
    .where(and(eq(threads.id, id), eq(threads.userId, userId)));
}

/** Everything the thread page shows, for its owner. */
export async function getThread(userId: string, id: string) {
  const thread = await requireThread(userId, id);
  const [member] = await db
    .select({ defaultInstruction: members.defaultInstruction })
    .from(members)
    .where(eq(members.userId, userId));
  return {
    id: thread.id,
    name: thread.name,
    status: thread.status as ThreadStatus,
    tags: parseTags(thread.tags),
    note: thread.note,
    instruction: thread.instruction,
    defaultInstruction: member?.defaultInstruction ?? "",
    shareToken: thread.shareToken,
    lastReadChapterId: thread.lastReadChapterId,
    createdAt: thread.createdAt,
  };
}

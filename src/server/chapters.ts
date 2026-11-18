import { and, asc, eq, inArray, max, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chapters, terms, threads } from "@/db/schema";
import type { ChapterStatus } from "@/shared/options";
import { getPreferences, type Identity } from "./members";
import { NotFoundError, requireThread } from "./threads";
import { withCurrentWording } from "./text";

/** A translating chapter older than this was cut off; it counts as failed. */
const STALE_MS = 10 * 60 * 1000;

export function effectiveStatus(row: {
  status: string;
  updatedAt: string;
}): ChapterStatus {
  if (row.status === "translating" && Date.now() - Date.parse(row.updatedAt) > STALE_MS) {
    return "failed";
  }
  return row.status as ChapterStatus;
}

export function parseUsed(raw: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function listChapters(userId: string, threadId: string) {
  await requireThread(userId, threadId);
  const rows = await db
    .select({
      id: chapters.id,
      position: chapters.position,
      title: chapters.title,
      sourceUrl: chapters.sourceUrl,
      status: chapters.status,
      failureReason: chapters.failureReason,
      read: chapters.read,
      bookmarked: chapters.bookmarked,
      createdAt: chapters.createdAt,
      updatedAt: chapters.updatedAt,
    })
    .from(chapters)
    .where(and(eq(chapters.threadId, threadId), eq(chapters.userId, userId)))
    .orderBy(asc(chapters.position), asc(chapters.createdAt));
  return rows.map((row, index) => ({
    ...row,
    number: index + 1,
    status: effectiveStatus(row),
  }));
}

export async function nextPosition(threadId: string): Promise<number> {
  const [row] = await db
    .select({ last: max(chapters.position) })
    .from(chapters)
    .where(eq(chapters.threadId, threadId));
  return (row?.last ?? 0) + 1;
}

export async function requireChapter(userId: string, chapterId: string) {
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.userId, userId)));
  if (!chapter) throw new NotFoundError("Chapter not found");
  return chapter;
}

/** The reader's view of a chapter. Opening it makes it the thread's last read. */
export async function openChapter(user: Identity, threadId: string, chapterId: string) {
  const chapter = await requireChapter(user.id, chapterId);
  if (chapter.threadId !== threadId) throw new NotFoundError("Chapter not found");
  const thread = await requireThread(user.id, threadId);
  const preferences = await getPreferences(user);
  const [order, glossary] = await Promise.all([
    db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.threadId, threadId), eq(chapters.userId, user.id)))
      .orderBy(asc(chapters.position), asc(chapters.createdAt)),
    db
      .select({ original: terms.original, translation: terms.translation })
      .from(terms)
      .where(and(eq(terms.threadId, threadId), eq(terms.userId, user.id))),
  ]);
  if (thread.lastReadChapterId !== chapterId) {
    await db
      .update(threads)
      .set({ lastReadChapterId: chapterId })
      .where(and(eq(threads.id, threadId), eq(threads.userId, user.id)));
  }
  const index = order.findIndex((row) => row.id === chapterId);
  const translation = preferences.liveTermUpdates
    ? withCurrentWording(chapter.translation, parseUsed(chapter.termsUsed), glossary)
    : chapter.translation;
  return {
    thread: { id: thread.id, name: thread.name },
    chapter: {
      id: chapter.id,
      number: index + 1,
      title: chapter.title,
      sourceUrl: chapter.sourceUrl,
      sourceText: chapter.sourceText,
      translation,
      model: chapter.model,
      status: effectiveStatus(chapter),
      failureReason: chapter.failureReason,
      read: chapter.read,
      bookmarked: chapter.bookmarked,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    },
    previousId: index > 0 ? order[index - 1]!.id : null,
    nextId: index >= 0 && index < order.length - 1 ? order[index + 1]!.id : null,
    nextUrl: chapter.nextUrl,
    preferences,
  };
}

export const updateChapterInput = z
  .object({
    id: z.string(),
    title: z.string().trim().min(1, "Enter a title").max(200).optional(),
    read: z.boolean().optional(),
    bookmarked: z.boolean().optional(),
  })
  .strict();

export async function updateChapter(
  userId: string,
  { id, ...change }: z.infer<typeof updateChapterInput>,
) {
  const [updated] = await db
    .update(chapters)
    .set(change)
    .where(and(eq(chapters.id, id), eq(chapters.userId, userId)))
    .returning({ id: chapters.id });
  if (!updated) throw new NotFoundError("Chapter not found");
}

export const bulkInput = z
  .object({ ids: z.array(z.string()).min(1).max(1000), read: z.boolean() })
  .strict();

export async function setRead(userId: string, ids: string[], read: boolean) {
  await db
    .update(chapters)
    .set({ read })
    .where(and(inArray(chapters.id, ids), eq(chapters.userId, userId)));
}

export const deleteChaptersInput = z
  .object({ ids: z.array(z.string()).min(1).max(1000) })
  .strict();

/** Deletes the member's chapters among `ids`, except any still translating. */
export async function deleteChapters(userId: string, ids: string[]) {
  const rows = await db
    .select({ id: chapters.id, status: chapters.status, updatedAt: chapters.updatedAt })
    .from(chapters)
    .where(and(inArray(chapters.id, ids), eq(chapters.userId, userId)));
  if (rows.length === 0) throw new NotFoundError("Chapter not found");
  const busy = rows.filter((row) => effectiveStatus(row) === "translating");
  const deletable = rows.filter((row) => effectiveStatus(row) !== "translating").map((row) => row.id);
  if (deletable.length > 0) {
    await db
      .delete(chapters)
      .where(and(inArray(chapters.id, deletable), eq(chapters.userId, userId)));
  }
  return { deleted: deletable.length, skipped: busy.length };
}

export const moveChapterInput = z
  .object({
    id: z.string(),
    targetId: z.string(),
    position: z.enum(["before", "after"]),
  })
  .strict();

/** Moves a chapter just before or after another of the same thread. */
export async function moveChapter(
  userId: string,
  { id, targetId, position }: z.infer<typeof moveChapterInput>,
) {
  const chapter = await requireChapter(userId, id);
  const target = await requireChapter(userId, targetId);
  if (chapter.threadId !== target.threadId || id === targetId) {
    throw new NotFoundError("Chapter not found");
  }
  const order = await db
    .select({ id: chapters.id, position: chapters.position })
    .from(chapters)
    .where(and(eq(chapters.threadId, chapter.threadId), eq(chapters.userId, userId), ne(chapters.id, id)))
    .orderBy(asc(chapters.position), asc(chapters.createdAt));
  const at = order.findIndex((row) => row.id === targetId) + (position === "after" ? 1 : 0);
  const ids = order.map((row) => row.id);
  ids.splice(at, 0, id);
  const statements = ids.map((chapterId, index) =>
    db
      .update(chapters)
      .set({ position: index + 1 })
      .where(and(eq(chapters.id, chapterId), eq(chapters.userId, userId))),
  );
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
}

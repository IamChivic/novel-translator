import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, members, terms, threads } from "@/db/schema";
import { parseUsed } from "./chapters";
import { withCurrentWording } from "./text";

// Anyone with a thread's link reads its finished chapters: titles and
// translations, nothing else.

async function sharedThread(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [thread] = await db
    .select({ id: threads.id, userId: threads.userId, name: threads.name })
    .from(threads)
    .where(eq(threads.shareToken, token));
  return thread ?? null;
}

async function doneChapters(thread: { id: string; userId: string }) {
  return db
    .select({ id: chapters.id, title: chapters.title })
    .from(chapters)
    .where(and(eq(chapters.threadId, thread.id), eq(chapters.userId, thread.userId), eq(chapters.status, "done")))
    .orderBy(asc(chapters.position), asc(chapters.createdAt));
}

export async function readSharedThread(token: string) {
  const thread = await sharedThread(token);
  if (!thread) return null;
  const list = await doneChapters(thread);
  return { name: thread.name, chapters: list.map(({ id, title }) => ({ id, title })) };
}

export async function readSharedChapter(token: string, chapterId: string) {
  const thread = await sharedThread(token);
  if (!thread) return null;
  const list = await doneChapters(thread);
  const index = list.findIndex((row) => row.id === chapterId);
  if (index < 0) return null;
  const [chapter] = await db
    .select({ title: chapters.title, translation: chapters.translation, termsUsed: chapters.termsUsed })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.threadId, thread.id)));
  if (!chapter) return null;
  const [owner] = await db
    .select({ live: members.liveTermUpdates })
    .from(members)
    .where(eq(members.userId, thread.userId));
  let translation = chapter.translation;
  if (owner?.live ?? true) {
    const glossary = await db
      .select({ original: terms.original, translation: terms.translation })
      .from(terms)
      .where(and(eq(terms.threadId, thread.id), eq(terms.userId, thread.userId)));
    translation = withCurrentWording(translation, parseUsed(chapter.termsUsed), glossary);
  }
  return {
    title: chapter.title,
    translation,
    previousId: list[index - 1]?.id ?? null,
    nextId: list[index + 1]?.id ?? null,
  };
}

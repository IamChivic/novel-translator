import type { getThreadPage } from "@/serverFunctions/thread";

export type ThreadPageData = Awaited<ReturnType<typeof getThreadPage>>;
export type ThreadData = ThreadPageData["thread"];
export type ChapterRow = ThreadPageData["chapters"][number];
export type TermRow = ThreadPageData["terms"][number];

export function chapterTitle(chapter: { title: string; sourceUrl: string | null; number: number }) {
  return chapter.title || chapter.sourceUrl || `Chapter ${chapter.number}`;
}

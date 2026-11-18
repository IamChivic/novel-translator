import { createIsomorphicFn } from "@tanstack/react-start";

// The share pages are public, and visitors without a session can't call
// server functions: on the server the loader reads the database directly,
// in the browser it fetches the public JSON routes under /share-api.

export interface SharedThread {
  name: string;
  chapters: { id: string; title: string }[];
}
export interface SharedChapter {
  title: string;
  translation: string;
  previousId: string | null;
  nextId: string | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export const loadSharedThread = createIsomorphicFn()
  .server(async (token: string): Promise<SharedThread | null> => {
    const { readSharedThread } = await import("@/server/share");
    return readSharedThread(token);
  })
  .client((token: string) =>
    getJson<SharedThread>(`/share-api/${encodeURIComponent(token)}`),
  );

export const loadSharedChapter = createIsomorphicFn()
  .server(async (token: string, chapterId: string): Promise<SharedChapter | null> => {
    const { readSharedChapter } = await import("@/server/share");
    return readSharedChapter(token, chapterId);
  })
  .client((token: string, chapterId: string) =>
    getJson<SharedChapter>(
      `/share-api/${encodeURIComponent(token)}/${encodeURIComponent(chapterId)}`,
    ),
  );

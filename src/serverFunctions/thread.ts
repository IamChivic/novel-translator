import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as chapters from "@/server/chapters";
import * as terms from "@/server/terms";
import * as threads from "@/server/threads";
import { orNotFound } from "./guard";

const threadIdInput = z.object({ threadId: z.string() }).strict();

/** Everything the thread page shows; the share link is built on this request's own host. */
export const getThreadPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threadIdInput.parse(data))
  .handler(({ data, context: { user } }) =>
    orNotFound(async () => {
      const [thread, chapterList, glossary] = await Promise.all([
        threads.getThread(user.id, data.threadId),
        chapters.listChapters(user.id, data.threadId),
        terms.listTerms(user.id, data.threadId),
      ]);
      const origin = new URL(getRequest().url).origin;
      const { shareToken, ...rest } = thread;
      return {
        thread: { ...rest, shareUrl: shareToken ? `${origin}/s/${shareToken}` : null },
        chapters: chapterList,
        terms: glossary,
      };
    }),
  );

export const updateThread = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.updateThreadInput.parse(data))
  .handler(({ data, context: { user } }) => threads.updateThread(user.id, data));

export const setInstruction = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.setInstructionInput.parse(data))
  .handler(({ data, context: { user } }) => threads.setInstruction(user.id, data));

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.threadIdInput.parse(data))
  .handler(({ data, context: { user } }) => threads.deleteThread(user.id, data.id));

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.threadIdInput.parse(data))
  .handler(({ data, context: { user } }) =>
    threads.createShareLink(user.id, data.id).then(() => undefined),
  );

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.threadIdInput.parse(data))
  .handler(({ data, context: { user } }) => threads.revokeShareLink(user.id, data.id));

export const updateChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chapters.updateChapterInput.parse(data))
  .handler(({ data, context: { user } }) => chapters.updateChapter(user.id, data));

export const setChaptersRead = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chapters.bulkInput.parse(data))
  .handler(({ data, context: { user } }) => chapters.setRead(user.id, data.ids, data.read));

export const deleteChapters = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chapters.deleteChaptersInput.parse(data))
  .handler(({ data, context: { user } }) => chapters.deleteChapters(user.id, data.ids));

export const moveChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chapters.moveChapterInput.parse(data))
  .handler(({ data, context: { user } }) => chapters.moveChapter(user.id, data));

export const saveTerm = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => terms.saveTermInput.parse(data))
  .handler(({ data, context: { user } }) => terms.saveTerm(user.id, data));

export const setTermExcluded = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => terms.excludeTermInput.parse(data))
  .handler(({ data, context: { user } }) => terms.setExcluded(user.id, data.id, data.excluded));

export const resetTerm = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => terms.termIdInput.parse(data))
  .handler(({ data, context: { user } }) => terms.resetToAuto(user.id, data.id));

export const deleteTerm = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => terms.termIdInput.parse(data))
  .handler(({ data, context: { user } }) => terms.deleteTerm(user.id, data.id));

export const addTermToDefaults = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => terms.termIdInput.parse(data))
  .handler(({ data, context: { user } }) => terms.addToDefaults(user.id, data.id));

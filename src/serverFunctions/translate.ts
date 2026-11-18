import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { aiStatus } from "@/server/ai";
import * as chapters from "@/server/chapters";
import { updatePreferences, updatePreferencesInput } from "@/server/members";
import { listThreads } from "@/server/threads";
import * as translation from "@/server/translate";
import { orNotFound } from "./guard";

export const getTranslatePage = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const [threads, ai] = await Promise.all([listThreads(user.id), aiStatus()]);
    return { threads: threads.map(({ id, name }) => ({ id, name })), ai };
  });

export const translateChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => translation.translateInput.parse(data))
  .handler(({ data, context: { user } }) => translation.translate(user, data));

export const retranslateChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => translation.retranslateInput.parse(data))
  .handler(({ data, context: { user } }) => translation.retranslate(user, data));

export const openNextChapter = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).strict().parse(data))
  .handler(({ data, context: { user } }) => translation.nextChapter(user, data.id));

export const getReader = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ threadId: z.string(), chapterId: z.string() }).strict().parse(data),
  )
  .handler(({ data, context: { user } }) =>
    orNotFound(async () => {
      const [view, ai] = await Promise.all([
        chapters.openChapter(user, data.threadId, data.chapterId),
        aiStatus(),
      ]);
      return { ...view, aiReady: ai.ready };
    }),
  );

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => updatePreferencesInput.parse(data))
  .handler(({ data, context: { user } }) => updatePreferences(user, data));

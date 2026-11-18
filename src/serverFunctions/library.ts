import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { ensureMember } from "@/server/members";
import * as threads from "@/server/threads";

export const getLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await ensureMember(user);
    return threads.listThreads(user.id);
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => threads.createThreadInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await ensureMember(user);
    return threads.createThread(user.id, data.name);
  });

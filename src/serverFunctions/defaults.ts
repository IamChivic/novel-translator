import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as members from "@/server/members";

export const getDefaultsPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const preferences = await members.getPreferences(user);
    return { preferences, terms: await members.listDefaultTerms(user.id) };
  });

export const saveDefaultTerm = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => members.saveDefaultTermInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await members.ensureMember(user);
    await members.saveDefaultTerm(user.id, data);
  });

export const deleteDefaultTerm = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => members.deleteDefaultTermInput.parse(data))
  .handler(({ data, context: { user } }) => members.deleteDefaultTerm(user.id, data.id));

import { createFileRoute } from "@tanstack/react-router";
import { readSharedThread } from "@/server/share";

// Public (everyapp.config.ts): a share link's chapter list, for anyone with
// the token. Titles only.
export const Route = createFileRoute("/share-api/$token")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const thread = await readSharedThread(params.token);
        if (!thread) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json(thread, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});

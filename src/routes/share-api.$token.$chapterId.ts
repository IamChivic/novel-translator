import { createFileRoute } from "@tanstack/react-router";
import { readSharedChapter } from "@/server/share";

// Public (everyapp.config.ts): one finished chapter of a shared thread.
export const Route = createFileRoute("/share-api/$token/$chapterId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string; chapterId: string } }) => {
        const chapter = await readSharedChapter(params.token, params.chapterId);
        if (!chapter) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json(chapter, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});

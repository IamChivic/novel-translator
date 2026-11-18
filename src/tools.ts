// The app's tools for AI clients, served by the Gateway at /mcp and called
// with the signed-in member. Read-only: each sees the member's own threads.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { listChapters } from "@/server/chapters";
import { NotFoundError, listThreads } from "@/server/threads";

export const tools = defineTools(
  {
    list_threads: {
      description: "List the member's novel threads with status, tags and chapter count.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => listThreads(user.id),
    },
    list_chapters: {
      description: "List one thread's chapters in reading order, with status and read flags.",
      risk: "read",
      input: z.object({ threadId: z.string() }).strict(),
      handler: async ({ threadId }, { user }) => {
        try {
          return await listChapters(user.id, threadId);
        } catch (error) {
          if (error instanceof NotFoundError) throw new ToolError("No thread with that id");
          throw error;
        }
      },
    },
  },
  { instructions: "Call list_threads first to learn thread ids." },
);

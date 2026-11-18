import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { loadSharedThread } from "@/serverFunctions/share";

export const Route = createFileRoute("/s/$token/")({
  loader: async ({ params }) => {
    const thread = await loadSharedThread(params.token);
    if (!thread) throw notFound();
    return thread;
  },
  head: ({ loaderData }) => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, ...(loaderData ? [{ title: loaderData.name }] : [])],
  }),
  component: SharedThread,
});

function SharedThread() {
  const thread = Route.useLoaderData();
  const { token } = Route.useParams();
  return (
    <AppShell>
      <PageHeader title={thread.name} />
      {thread.chapters.length === 0 ? (
        <EmptyState title="No chapters yet" />
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {thread.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <Link
                data-testid="share-chapter"
                to="/s/$token/$chapterId"
                params={{ token, chapterId: chapter.id }}
                className="flex gap-3 px-5 py-3 hover:bg-muted"
              >
                <span className="w-8 text-muted-foreground tabular-nums">{index + 1}</span>
                <span>{chapter.title || `Chapter ${index + 1}`}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}

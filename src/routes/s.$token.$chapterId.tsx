import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { ChapterText } from "@/client/components/ChapterText";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { loadSharedChapter } from "@/serverFunctions/share";

export const Route = createFileRoute("/s/$token/$chapterId")({
  loader: async ({ params }) => {
    const chapter = await loadSharedChapter(params.token, params.chapterId);
    if (!chapter) throw notFound();
    return chapter;
  },
  head: ({ loaderData }) => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }, ...(loaderData ? [{ title: loaderData.title }] : [])],
  }),
  component: SharedChapter,
});

function SharedChapter() {
  const chapter = Route.useLoaderData();
  const { token } = Route.useParams();
  return (
    <AppShell>
      <PageHeader
        title={chapter.title || "Chapter"}
        backLink={
          <Link
            to="/s/$token"
            params={{ token }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            All chapters
          </Link>
        }
      />
      <ChapterText testId="share-translation" text={chapter.translation} />
      <div className="flex items-center justify-between gap-2 border-t border-border pt-6">
        {chapter.previousId ? (
          <Button
            variant="outline"
            data-testid="share-prev"
            render={<Link to="/s/$token/$chapterId" params={{ token, chapterId: chapter.previousId }} />}
          >
            <ChevronLeft />
            Previous
          </Button>
        ) : (
          <span />
        )}
        {chapter.nextId ? (
          <Button
            data-testid="share-next"
            render={<Link to="/s/$token/$chapterId" params={{ token, chapterId: chapter.nextId }} />}
          >
            Next chapter
            <ChevronRight />
          </Button>
        ) : null}
      </div>
    </AppShell>
  );
}

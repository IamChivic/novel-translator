import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { ChaptersTab } from "@/client/features/thread/ChaptersTab";
import { GlossaryTab } from "@/client/features/thread/GlossaryTab";
import { SettingsTab } from "@/client/features/thread/SettingsTab";
import { getThreadPage } from "@/serverFunctions/thread";
import { THREAD_STATUS_LABELS } from "@/shared/options";

const TABS = ["chapters", "glossary", "settings"] as const;

export const Route = createFileRoute("/threads/$threadId/")({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  loader: ({ params }) => getThreadPage({ data: { threadId: params.threadId } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.thread.name} · Novel Translator` }] : [],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const data = Route.useLoaderData();
  const { tab = "chapters" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { thread } = data;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={thread.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={thread.status === "reading" ? "soft" : "secondary"}>
              {THREAD_STATUS_LABELS[thread.status]}
            </Badge>
            {thread.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </span>
        }
        backLink={
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Library
          </Link>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({ search: { tab: value === "chapters" ? undefined : (value as (typeof TABS)[number]) }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="chapters" className="pt-4">
          <ChaptersTab thread={thread} chapters={data.chapters} />
        </TabsContent>
        <TabsContent value="glossary" className="pt-4">
          <GlossaryTab threadId={thread.id} terms={data.terms} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <SettingsTab thread={thread} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

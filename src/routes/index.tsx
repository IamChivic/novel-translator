import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { formatDate, messageOf } from "@/client/lib/errors";
import { createThread, getLibrary } from "@/serverFunctions/library";
import { THREAD_STATUS_LABELS, type ThreadStatus } from "@/shared/options";

export const Route = createFileRoute("/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library · Novel Translator" }] }),
  component: Library,
});

type StatusFilter = "all" | ThreadStatus;
type Sort = "translated" | "created" | "name";
const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: "translated", label: "Last translated" },
  { value: "created", label: "Created" },
  { value: "name", label: "Name" },
];
const ALL_TAGS = "__all__";

function Library() {
  const threads = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tag, setTag] = useState(ALL_TAGS);
  const [sort, setSort] = useState<Sort>("translated");
  const [creating, setCreating] = useState(false);

  const tags = useMemo(
    () => [...new Set(threads.flatMap((thread) => thread.tags))].sort((a, b) => a.localeCompare(b)),
    [threads],
  );
  const tagItems = [{ value: ALL_TAGS, label: "All tags" }, ...tags.map((value) => ({ value, label: value }))];

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = threads.filter(
      (thread) =>
        (status === "all" || thread.status === status) &&
        (tag === ALL_TAGS || thread.tags.includes(tag)) &&
        (!needle ||
          thread.name.toLowerCase().includes(needle) ||
          thread.tags.some((value) => value.toLowerCase().includes(needle))),
    );
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return (b.lastTranslatedAt ?? b.createdAt).localeCompare(a.lastTranslatedAt ?? a.createdAt);
    });
  }, [threads, query, status, tag, sort]);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Library"
        actions={
          <Button data-testid="new-thread" onClick={() => setCreating(true)}>
            <Plus />
            New thread
          </Button>
        }
      />
      {threads.length === 0 ? (
        <EmptyState
          title="No threads yet"
          description="Translate a chapter or create a thread and it will appear here."
          action={
            <Button render={<Link to="/translate" />} variant="outline">
              Translate a chapter
            </Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              data-testid="library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or tag"
              aria-label="Search threads"
              className="min-w-48 flex-1 bg-card"
            />
            <Select items={tagItems} value={tag} onValueChange={(value) => setTag(value ?? ALL_TAGS)}>
              <SelectTrigger data-testid="tag-filter" aria-label="Tag" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tagItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
              <SelectTrigger data-testid="library-sort" aria-label="Sort" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all" data-testid="status-all">
                All
              </TabsTrigger>
              {(Object.keys(THREAD_STATUS_LABELS) as ThreadStatus[]).map((value) => (
                <TabsTrigger key={value} value={value} data-testid={`status-${value}`}>
                  {THREAD_STATUS_LABELS[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {shown.length === 0 ? (
            <EmptyState kind="filtered" title="No threads match" />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {shown.map((thread) => (
                <li key={thread.id} data-testid="thread-row" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      to="/threads/$threadId"
                      params={{ threadId: thread.id }}
                      className="font-medium hover:underline"
                    >
                      {thread.name}
                    </Link>
                    {thread.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {thread.tags.map((value) => (
                          <Badge key={value} variant="outline">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Badge variant={thread.status === "reading" ? "soft" : "secondary"}>
                    {THREAD_STATUS_LABELS[thread.status]}
                  </Badge>
                  <span className="w-24 text-sm text-muted-foreground">
                    {thread.chapterCount} {thread.chapterCount === 1 ? "chapter" : "chapters"}
                  </span>
                  <span className="w-28 text-right text-sm text-muted-foreground">
                    {formatDate(thread.lastTranslatedAt ?? thread.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {creating ? <CreateThreadDialog onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

function CreateThreadDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const thread = await createThread({ data: { name } });
      await navigate({ to: "/threads/$threadId", params: { threadId: thread.id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="create-thread-name">Name</Label>
            <Input
              id="create-thread-name"
              data-testid="create-thread-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" data-testid="create-thread-save" pending={pending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

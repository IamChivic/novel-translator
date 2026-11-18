import { Link } from "@tanstack/react-router";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
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
import { useAction } from "@/client/hooks/useAction";
import { formatDate } from "@/client/lib/errors";
import {
  deleteChapters,
  moveChapter,
  setChaptersRead,
  updateChapter,
} from "@/serverFunctions/thread";
import { retranslateChapter } from "@/serverFunctions/translate";
import { chapterTitle, type ChapterRow, type ThreadData } from "./types";

type Filter = "all" | "unread" | "failed" | "bookmarked";
type Sort = "order" | "newest" | "title";
const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: "order", label: "Thread order" },
  { value: "newest", label: "Newest first" },
  { value: "title", label: "Title" },
];
const STATUS_LABELS = { done: "Done", failed: "Failed", translating: "Translating" } as const;

const MATCHES: Record<Filter, (chapter: ChapterRow) => boolean> = {
  all: () => true,
  unread: (chapter) => !chapter.read,
  failed: (chapter) => chapter.status === "failed",
  bookmarked: (chapter) => chapter.bookmarked,
};

export function ChaptersTab({ thread, chapters }: { thread: ThreadData; chapters: ChapterRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("order");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<ChapterRow | null>(null);
  const [moving, setMoving] = useState<ChapterRow | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const { run, pending } = useAction();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = chapters.filter(
      (chapter) => MATCHES[filter](chapter) && (!needle || chapterTitle(chapter).toLowerCase().includes(needle)),
    );
    if (sort === "newest") return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "title") return [...list].sort((a, b) => chapterTitle(a).localeCompare(chapterTitle(b)));
    return list;
  }, [chapters, query, filter, sort]);

  const chosen = chapters.filter((chapter) => selected.has(chapter.id)).map((chapter) => chapter.id);
  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  if (chapters.length === 0) {
    return (
      <EmptyState
        title="No chapters yet"
        description="Translate a chapter into this thread and it will appear here."
        action={
          <Button render={<Link to="/translate" />} variant="outline">
            Translate a chapter
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid="chapter-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles"
          aria-label="Search chapters"
          className="min-w-48 flex-1 bg-card"
        />
        <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
          <SelectTrigger data-testid="chapter-sort" aria-label="Sort" className="w-40">
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
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList>
          {(["all", "unread", "failed", "bookmarked"] as const).map((value) => (
            <TabsTrigger key={value} value={value} data-testid={`chapter-filter-${value}`}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
              <span className="text-muted-foreground tabular-nums">{chapters.filter(MATCHES[value]).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {chosen.length > 0 ? (
        <div
          data-testid="bulk-bar"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm"
        >
          <span className="mr-auto">{chosen.length} selected</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => setChaptersRead({ data: { ids: chosen, read: true } }))}>
            Mark read
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => setChaptersRead({ data: { ids: chosen, read: false } }))}>
            Mark unread
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDeleting(chosen)}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState kind="filtered" title="No chapters match" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {shown.map((chapter) => {
            const title = chapterTitle(chapter);
            return (
              <li
                key={chapter.id}
                data-testid="chapter-row"
                data-chapter-id={chapter.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-2 pl-4"
              >
                <Checkbox
                  aria-label={`Select ${title}`}
                  checked={selected.has(chapter.id)}
                  onCheckedChange={(on) => toggle(chapter.id, on)}
                />
                <span className="w-8 text-sm text-muted-foreground tabular-nums">{chapter.number}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/threads/$threadId/chapters/$chapterId"
                    params={{ threadId: thread.id, chapterId: chapter.id }}
                    className={chapter.read ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}
                  >
                    {title}
                  </Link>
                  {chapter.status === "failed" && chapter.failureReason ? (
                    <p className="truncate text-xs text-destructive">{chapter.failureReason}</p>
                  ) : null}
                </div>
                {thread.lastReadChapterId === chapter.id ? (
                  <Badge data-testid="last-read" variant="soft">
                    Last read
                  </Badge>
                ) : null}
                {chapter.bookmarked ? <Bookmark aria-label="Bookmarked" className="size-4 fill-current text-primary" /> : null}
                {chapter.read ? <Badge variant="outline">Read</Badge> : null}
                <Badge variant={chapter.status === "failed" ? "destructive" : chapter.status === "done" ? "secondary" : "outline"}>
                  {STATUS_LABELS[chapter.status]}
                </Badge>
                <span className="w-24 text-right text-sm text-muted-foreground">{formatDate(chapter.createdAt)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`} />}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => void run(() => updateChapter({ data: { id: chapter.id, bookmarked: !chapter.bookmarked } }))}
                    >
                      {chapter.bookmarked ? "Remove bookmark" : "Bookmark"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void run(() => updateChapter({ data: { id: chapter.id, read: !chapter.read } }))}>
                      {chapter.read ? "Mark unread" : "Mark read"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenaming(chapter)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem disabled={chapters.length < 2} onClick={() => setMoving(chapter)}>
                      Move
                    </DropdownMenuItem>
                    {chapter.status !== "translating" ? (
                      <DropdownMenuItem onClick={() => void run(() => retranslateChapter({ data: { id: chapter.id } }))}>
                        {chapter.status === "failed" ? "Try again" : "Translate again"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={chapter.status === "translating"}
                      onClick={() => setDeleting([chapter.id])}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
      {renaming ? <RenameDialog chapter={renaming} onClose={() => setRenaming(null)} /> : null}
      {moving ? <MoveDialog chapter={moving} chapters={chapters} onClose={() => setMoving(null)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={deleting.length === 1 ? "Delete this chapter?" : `Delete ${deleting.length} chapters?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteChapters({ data: { ids: deleting } }));
            setSelected(new Set());
            setDeleting(null);
          }}
        >
          This can't be undone.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function RenameDialog({ chapter, onClose }: { chapter: ChapterRow; onClose: () => void }) {
  const [title, setTitle] = useState(chapterTitle(chapter));
  const { run, pending } = useAction();
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename chapter</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run(() => updateChapter({ data: { id: chapter.id, title } }))) onClose();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rename-input">Title</Label>
            <Input id="rename-input" data-testid="rename-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="rename-save" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const POSITION_ITEMS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

function MoveDialog({ chapter, chapters, onClose }: { chapter: ChapterRow; chapters: ChapterRow[]; onClose: () => void }) {
  const others = chapters.filter((other) => other.id !== chapter.id);
  const targetItems = others.map((other) => ({ value: other.id, label: chapterTitle(other) }));
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");
  const [position, setPosition] = useState<"before" | "after">("after");
  const { run, pending } = useAction();
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{chapterTitle(chapter)}”</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run(() => moveChapter({ data: { id: chapter.id, targetId, position } }))) onClose();
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Select items={POSITION_ITEMS} value={position} onValueChange={(value) => value && setPosition(value as "before" | "after")}>
              <SelectTrigger data-testid="move-position" aria-label="Position" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select items={targetItems} value={targetId} onValueChange={(value) => value && setTargetId(value)}>
              <SelectTrigger data-testid="move-target" aria-label="Chapter" className="min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targetItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="move-save" pending={pending} disabled={!targetId}>
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

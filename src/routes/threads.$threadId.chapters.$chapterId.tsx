import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Type } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChapterText } from "@/client/components/ChapterText";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/client/components/ui/popover";
import { Spinner } from "@/client/components/ui/spinner";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/hooks/useAction";
import { messageOf } from "@/client/lib/errors";
import {
  getReader,
  openNextChapter,
  retranslateChapter,
  savePreferences,
} from "@/serverFunctions/translate";
import {
  MAX_SOURCE_CHARS,
  modelLabel,
  type FontFamily,
  type ReadingWidth,
  type TextSize,
} from "@/shared/options";

export const Route = createFileRoute("/threads/$threadId/chapters/$chapterId")({
  loader: ({ params }) => getReader({ data: params }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.chapter.title || "Chapter"} · Novel Translator` }] : [],
  }),
  component: Reader,
});

const STATUS_LABELS = { done: "Done", failed: "Failed", translating: "Translating" } as const;

function Reader() {
  const data = Route.useLoaderData();
  const { chapter, thread } = data;
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(data.preferences);
  const [showOriginal, setShowOriginal] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [goingNext, setGoingNext] = useState(false);
  const [nextError, setNextError] = useState<string | null>(null);
  const { run, pending } = useAction();
  const title = chapter.title || chapter.sourceUrl || `Chapter ${chapter.number}`;

  function changePrefs(change: Partial<typeof prefs>) {
    setPrefs((current) => ({ ...current, ...change }));
    void savePreferences({ data: change });
  }

  async function goNext() {
    if (data.nextId) {
      await navigate({ to: "/threads/$threadId/chapters/$chapterId", params: { threadId: thread.id, chapterId: data.nextId } });
      return;
    }
    setGoingNext(true);
    setNextError(null);
    try {
      const next = await openNextChapter({ data: { id: chapter.id } });
      await navigate({ to: "/threads/$threadId/chapters/$chapterId", params: { threadId: next.threadId, chapterId: next.chapterId } });
    } catch (error) {
      setNextError(messageOf(error));
    } finally {
      setGoingNext(false);
    }
  }

  function download() {
    const blob = new Blob([`${title}\n\n${chapter.translation}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "chapter"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const done = chapter.status === "done";
  const canGoNext = Boolean(data.nextId) || (Boolean(data.nextUrl) && data.aiReady);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={title}
        backLink={
          <Link
            to="/threads/$threadId"
            params={{ threadId: thread.id }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {thread.name}
          </Link>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Chapter {chapter.number}</span>
            <span aria-hidden>·</span>
            <span>{modelLabel(chapter.model)}</span>
            <Badge data-testid="chapter-status" variant={chapter.status === "failed" ? "destructive" : "secondary"}>
              {STATUS_LABELS[chapter.status]}
            </Badge>
          </span>
        }
        actions={
          done ? (
            <>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="sm" data-testid="reading-settings" />}>
                  <Type />
                  Reading
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto space-y-3">
                  <PrefRow label="Text size">
                    <SegmentedToggle<TextSize>
                      showLabels
                      value={prefs.textSize}
                      onChange={(textSize) => changePrefs({ textSize })}
                      items={[
                        { value: "sm", label: "Small", icon: null },
                        { value: "md", label: "Medium", icon: null },
                        { value: "lg", label: "Large", icon: null },
                        { value: "xl", label: "Extra large", icon: null },
                      ]}
                    />
                  </PrefRow>
                  <PrefRow label="Width">
                    <SegmentedToggle<ReadingWidth>
                      showLabels
                      value={prefs.readingWidth}
                      onChange={(readingWidth) => changePrefs({ readingWidth })}
                      items={[
                        { value: "narrow", label: "Narrow", icon: null },
                        { value: "medium", label: "Standard", icon: null },
                        { value: "wide", label: "Wide", icon: null },
                      ]}
                    />
                  </PrefRow>
                  <PrefRow label="Font">
                    <SegmentedToggle<FontFamily>
                      showLabels
                      value={prefs.fontFamily}
                      onChange={(fontFamily) => changePrefs({ fontFamily })}
                      items={[
                        { value: "sans", label: "Sans", icon: null },
                        { value: "serif", label: "Serif", icon: null },
                        { value: "mono", label: "Mono", icon: null },
                      ]}
                    />
                  </PrefRow>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" data-testid="toggle-original" onClick={() => setShowOriginal((on) => !on)}>
                {showOriginal ? "Hide original" : "Show original"}
              </Button>
              <span data-testid="copy-translation">
                <CopyButton value={chapter.translation} successMessage="Translation copied" size="sm" />
              </span>
              <Button variant="outline" size="sm" data-testid="download-translation" onClick={download}>
                <Download />
                Download
              </Button>
            </>
          ) : null
        }
      />

      {chapter.status === "failed" ? (
        <Alert variant="destructive" data-testid="chapter-failure">
          <AlertTitle>This chapter wasn't translated</AlertTitle>
          <AlertDescription>
            <p>{chapter.failureReason ?? "The translation failed."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                data-testid="retry-chapter"
                pending={pending}
                disabled={!data.aiReady}
                onClick={() => void run(() => retranslateChapter({ data: { id: chapter.id } }))}
              >
                Try again
              </Button>
              <Button size="sm" variant="outline" data-testid="paste-instead" onClick={() => setPasting(true)}>
                Paste text instead
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {chapter.status === "translating" ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          Translating…
        </div>
      ) : null}

      {done ? (
        <div className={showOriginal ? "grid gap-8 md:grid-cols-2" : ""}>
          <ChapterText
            testId="chapter-translation"
            text={chapter.translation}
            size={prefs.textSize}
            width={showOriginal ? "wide" : prefs.readingWidth}
            font={prefs.fontFamily}
          />
          {showOriginal ? (
            <ChapterText testId="chapter-original" text={chapter.sourceText} size={prefs.textSize} width="wide" font={prefs.fontFamily} />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
        {data.previousId ? (
          <Button
            variant="outline"
            data-testid="prev-chapter"
            render={<Link to="/threads/$threadId/chapters/$chapterId" params={{ threadId: thread.id, chapterId: data.previousId }} />}
          >
            <ChevronLeft />
            Previous
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <Button
              variant="ghost"
              data-testid="retranslate-chapter"
              pending={pending}
              disabled={!data.aiReady}
              onClick={() => void run(() => retranslateChapter({ data: { id: chapter.id } }))}
            >
              Translate again
            </Button>
          ) : null}
          <Button data-testid="next-chapter" pending={goingNext} disabled={!canGoNext} onClick={() => void goNext()}>
            {goingNext && !data.nextId ? "Translating next chapter…" : "Next chapter"}
            <ChevronRight />
          </Button>
        </div>
      </div>
      {nextError ? (
        <Alert variant="destructive">
          <AlertDescription>{nextError}</AlertDescription>
        </Alert>
      ) : null}
      {pasting ? <PasteDialog chapterId={chapter.id} onClose={() => setPasting(false)} /> : null}
    </AppShell>
  );
}

function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function PasteDialog({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const { run, pending } = useAction();
  const tooLong = text.trim().length > MAX_SOURCE_CHARS;
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste the chapter</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run(() => retranslateChapter({ data: { id: chapterId, text } }))) onClose();
          }}
        >
          <Textarea
            data-testid="paste-text"
            aria-label="Chapter text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
          />
          {tooLong ? (
            <p className="text-sm text-destructive">Over {MAX_SOURCE_CHARS.toLocaleString("en-US")} characters.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" data-testid="paste-submit" pending={pending} disabled={!text.trim() || tooLong}>
              {pending ? "Translating…" : "Translate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

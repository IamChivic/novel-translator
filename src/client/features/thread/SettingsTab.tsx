import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/hooks/useAction";
import {
  createShareLink,
  deleteThread,
  revokeShareLink,
  setInstruction,
  updateThread,
} from "@/serverFunctions/thread";
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  THREAD_STATUSES,
  THREAD_STATUS_LABELS,
  type ThreadStatus,
} from "@/shared/options";
import type { ThreadData } from "./types";

const STATUS_ITEMS = THREAD_STATUSES.map((value) => ({ value, label: THREAD_STATUS_LABELS[value] }));

function splitTags(text: string): string[] {
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function SettingsTab({ thread }: { thread: ThreadData }) {
  return (
    <div className="space-y-10">
      <DetailsSection thread={thread} key={`details-${thread.id}`} />
      <InstructionSection thread={thread} key={`instruction-${thread.id}-${thread.instruction ?? ""}`} />
      <ShareSection thread={thread} />
      <DeleteSection thread={thread} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function DetailsSection({ thread }: { thread: ThreadData }) {
  const [name, setName] = useState(thread.name);
  const [status, setStatus] = useState<ThreadStatus>(thread.status);
  const [tags, setTags] = useState(thread.tags.join(", "));
  const [note, setNote] = useState(thread.note);
  const [saved, setSaved] = useState(false);
  const { run, pending } = useAction();
  const tagList = splitTags(tags);
  const tagProblem =
    tagList.length > MAX_TAGS
      ? `At most ${MAX_TAGS} tags.`
      : tagList.some((tag) => tag.length > MAX_TAG_LENGTH)
        ? `Tags are at most ${MAX_TAG_LENGTH} characters.`
        : null;
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setSaved(false);
  };

  return (
    <Section title="Details">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await run(() =>
            updateThread({ data: { id: thread.id, name, status, tags: tagList, note } }),
          );
          setSaved(ok);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1.5">
            <Label htmlFor="thread-name">Name</Label>
            <Input
              id="thread-name"
              data-testid="thread-name"
              value={name}
              onChange={(event) => edit(setName)(event.target.value)}
              required
              className="bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select items={STATUS_ITEMS} value={status} onValueChange={(value) => value && edit(setStatus)(value as ThreadStatus)}>
              <SelectTrigger data-testid="thread-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thread-tags">Tags</Label>
          <Input
            id="thread-tags"
            data-testid="thread-tags"
            value={tags}
            onChange={(event) => edit(setTags)(event.target.value)}
            placeholder="Separated by commas"
            aria-invalid={tagProblem ? true : undefined}
            className="bg-card"
          />
          {tagProblem ? <p className="text-sm text-destructive">{tagProblem}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thread-note">Private note</Label>
          <Textarea
            id="thread-note"
            data-testid="thread-note"
            value={note}
            onChange={(event) => edit(setNote)(event.target.value)}
            rows={3}
            className="bg-card"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" data-testid="thread-save" pending={pending} disabled={Boolean(tagProblem)}>
            Save
          </Button>
          {saved ? (
            <span data-testid="thread-saved" className="text-sm text-muted-foreground">
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </Section>
  );
}

function InstructionSection({ thread }: { thread: ThreadData }) {
  const custom = thread.instruction !== null;
  const [text, setText] = useState(thread.instruction ?? thread.defaultInstruction);
  const { run, pending } = useAction();
  return (
    <Section title="Instruction">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {custom ? (
          <Badge data-testid="instruction-custom" variant="soft">
            Custom for this thread
          </Badge>
        ) : (
          <span>Your default instruction</span>
        )}
      </div>
      <Textarea
        data-testid="thread-instruction"
        aria-label="Instruction"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Style and tone for this novel's chapters"
        rows={4}
        className="bg-card"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="instruction-save"
          pending={pending}
          onClick={() => void run(() => setInstruction({ data: { id: thread.id, instruction: text } }))}
        >
          Save for this thread
        </Button>
        {custom ? (
          <Button
            variant="outline"
            data-testid="instruction-use-default"
            disabled={pending}
            onClick={() => void run(() => setInstruction({ data: { id: thread.id, instruction: null } }))}
          >
            Use my default instead
          </Button>
        ) : null}
      </div>
    </Section>
  );
}

function ShareSection({ thread }: { thread: ThreadData }) {
  const { run, pending } = useAction();
  return (
    <Section title="Share link">
      {thread.shareUrl ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Anyone with the link can read the translated chapters.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input data-testid="share-url" readOnly value={thread.shareUrl} aria-label="Share link" className="min-w-0 flex-1 bg-card" />
            <CopyButton value={thread.shareUrl} successMessage="Link copied" size="default" />
            <Button
              variant="outline"
              data-testid="share-revoke"
              pending={pending}
              onClick={() => void run(() => revokeShareLink({ data: { id: thread.id } }))}
            >
              Revoke
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          data-testid="share-create"
          pending={pending}
          onClick={() => void run(() => createShareLink({ data: { id: thread.id } }))}
        >
          Create share link
        </Button>
      )}
    </Section>
  );
}

function DeleteSection({ thread }: { thread: ThreadData }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <Section title="Delete thread">
      <Button variant="destructive" data-testid="thread-delete" onClick={() => setConfirming(true)}>
        Delete
      </Button>
      {confirming ? (
        <ConfirmDialog
          title={`Delete “${thread.name}”?`}
          confirmLabel="Delete thread"
          destructive
          pending={pending}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setPending(true);
            await deleteThread({ data: { id: thread.id } });
            await router.invalidate();
            await navigate({ to: "/" });
          }}
        >
          Its chapters, glossary and share link are deleted too.
        </ConfirmDialog>
      ) : null}
    </Section>
  );
}

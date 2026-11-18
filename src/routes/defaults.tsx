import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { TermDialog, type TermValues } from "@/client/components/TermDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/hooks/useAction";
import { deleteDefaultTerm, getDefaultsPage, saveDefaultTerm } from "@/serverFunctions/defaults";
import { savePreferences } from "@/serverFunctions/translate";
import { GENDER_LABELS, type Gender } from "@/shared/options";

export const Route = createFileRoute("/defaults")({
  loader: () => getDefaultsPage(),
  head: () => ({ meta: [{ title: "Defaults · Novel Translator" }] }),
  component: DefaultsPage,
});

type DefaultTerm = Awaited<ReturnType<typeof getDefaultsPage>>["terms"][number];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DefaultsPage() {
  const { preferences, terms } = Route.useLoaderData();
  const [instruction, setInstruction] = useState(preferences.defaultInstruction);
  const [saved, setSaved] = useState(false);
  const [findNewTerms, setFindNewTerms] = useState(preferences.findNewTerms);
  const [liveTermUpdates, setLiveTermUpdates] = useState(preferences.liveTermUpdates);
  const [editing, setEditing] = useState<DefaultTerm | "new" | null>(null);
  const [deleting, setDeleting] = useState<DefaultTerm | null>(null);
  const { run, pending } = useAction();

  async function save(values: TermValues) {
    const id = editing && editing !== "new" ? editing.id : undefined;
    const ok = await run(() => saveDefaultTerm({ data: { ...(id ? { id } : {}), ...values } }));
    if (!ok) throw new Error("The term wasn't saved.");
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Defaults" />

      <Section title="Default instruction" description="Sent with every chapter, unless a thread has its own.">
        <Textarea
          data-testid="default-instruction"
          aria-label="Default instruction"
          value={instruction}
          onChange={(event) => {
            setInstruction(event.target.value);
            setSaved(false);
          }}
          placeholder="Style and tone, such as how to render honorifics"
          rows={4}
          className="bg-card"
        />
        <div className="flex items-center gap-3">
          <Button
            data-testid="default-instruction-save"
            pending={pending}
            onClick={async () => setSaved(await run(() => savePreferences({ data: { defaultInstruction: instruction } })))}
          >
            Save
          </Button>
          {saved ? (
            <span data-testid="default-instruction-saved" className="text-sm text-muted-foreground">
              Saved
            </span>
          ) : null}
        </div>
      </Section>

      <Section
        title="Default terms"
        description="Copied into a thread when a chapter uses them. Later edits here don't change threads that already have the term."
      >
        <div>
          <Button data-testid="add-default-term" variant="outline" onClick={() => setEditing("new")}>
            <Plus />
            Add term
          </Button>
        </div>
        {terms.length === 0 ? (
          <EmptyState title="No default terms" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {terms.map((term) => (
              <li key={term.id} data-testid="default-term-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{term.original}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span>{term.translation}</span>
                  </p>
                  {term.note ? <p className="truncate text-sm text-muted-foreground">{term.note}</p> : null}
                </div>
                {term.gender !== "none" ? <Badge variant="outline">{GENDER_LABELS[term.gender as Gender]}</Badge> : null}
                {term.alwaysUse ? <Badge variant="soft">Always use</Badge> : null}
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${term.original}`} />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(term)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(term)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Glossary">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="pref-find-terms"
              data-testid="pref-find-terms"
              checked={findNewTerms}
              onCheckedChange={(on) => {
                setFindNewTerms(on);
                void run(() => savePreferences({ data: { findNewTerms: on } }));
              }}
            />
            <Label htmlFor="pref-find-terms">Add new terms after each translation</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="pref-live-terms"
              data-testid="pref-live-terms"
              checked={liveTermUpdates}
              onCheckedChange={(on) => {
                setLiveTermUpdates(on);
                void run(() => savePreferences({ data: { liveTermUpdates: on } }));
              }}
            />
            <Label htmlFor="pref-live-terms">Show glossary changes in chapters already translated</Label>
          </div>
        </div>
      </Section>

      {editing ? (
        <TermDialog
          title={editing === "new" ? "Add default term" : "Edit default term"}
          initial={editing === "new" ? undefined : { ...editing, gender: editing.gender as Gender }}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.original}”?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteDefaultTerm({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          Threads that already have it keep their copy.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

import { MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { TermDialog, type TermValues } from "@/client/components/TermDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { Input } from "@/client/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { useAction } from "@/client/hooks/useAction";
import {
  addTermToDefaults,
  deleteTerm,
  resetTerm,
  saveTerm,
  setTermExcluded,
} from "@/serverFunctions/thread";
import { GENDER_LABELS, TERM_SOURCE_LABELS } from "@/shared/options";
import type { TermRow } from "./types";

type Filter = "all" | "male" | "female" | "always" | "excluded";
const FILTERS: { value: Filter; label: string; matches: (term: TermRow) => boolean }[] = [
  { value: "all", label: "All", matches: () => true },
  { value: "male", label: "Male", matches: (term) => term.gender === "male" },
  { value: "female", label: "Female", matches: (term) => term.gender === "female" },
  { value: "always", label: "Always used", matches: (term) => term.alwaysUse },
  { value: "excluded", label: "Excluded", matches: (term) => term.excluded },
];

export function GlossaryTab({ threadId, terms }: { threadId: string; terms: TermRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<TermRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TermRow | null>(null);
  const { run, pending } = useAction();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = FILTERS.find((item) => item.value === filter)!.matches;
    return terms.filter(
      (term) =>
        matches(term) &&
        (!needle ||
          term.original.toLowerCase().includes(needle) ||
          term.translation.toLowerCase().includes(needle) ||
          term.note.toLowerCase().includes(needle)),
    );
  }, [terms, query, filter]);

  async function save(values: TermValues) {
    const id = editing && editing !== "new" ? editing.id : undefined;
    const ok = await run(() => saveTerm({ data: { threadId, ...(id ? { id } : {}), ...values } }));
    if (!ok) throw new Error("The term wasn't saved.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          data-testid="term-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search terms, translations and notes"
          aria-label="Search glossary"
          className="min-w-48 flex-1 bg-card"
        />
        <Button data-testid="add-term" onClick={() => setEditing("new")}>
          <Plus />
          Add term
        </Button>
      </div>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList>
          {FILTERS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} data-testid={`term-filter-${item.value}`}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {terms.length === 0 ? (
        <EmptyState title="No terms yet" description="Names and terms from translated chapters are added here." />
      ) : shown.length === 0 ? (
        <EmptyState kind="filtered" title="No terms match" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {shown.map((term) => (
            <li
              key={term.id}
              data-testid="term-row"
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-2 pl-4 ${term.excluded ? "opacity-60" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium">{term.original}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span>{term.translation}</span>
                </p>
                {term.note ? <p className="truncate text-sm text-muted-foreground">{term.note}</p> : null}
              </div>
              {term.gender !== "none" ? <Badge variant="outline">{GENDER_LABELS[term.gender]}</Badge> : null}
              {term.alwaysUse ? <Badge variant="soft">Always use</Badge> : null}
              {term.excluded ? <Badge variant="destructive">Excluded</Badge> : null}
              <Badge variant="secondary">{TERM_SOURCE_LABELS[term.source]}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${term.original}`} />}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(term)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void run(() => setTermExcluded({ data: { id: term.id, excluded: !term.excluded } }))}
                  >
                    {term.excluded ? "Include" : "Exclude"}
                  </DropdownMenuItem>
                  {term.autoTranslation && term.source !== "auto" ? (
                    <DropdownMenuItem onClick={() => void run(() => resetTerm({ data: { id: term.id } }))}>
                      Reset to auto
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => void run(() => addTermToDefaults({ data: { id: term.id } }))}>
                    {term.source === "default" ? "Update your defaults" : "Add to your defaults"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(term)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <TermDialog
          title={editing === "new" ? "Add term" : "Edit term"}
          initial={editing === "new" ? undefined : editing}
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
            await run(() => deleteTerm({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          The next translation may add it again.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

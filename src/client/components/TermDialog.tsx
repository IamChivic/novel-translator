import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
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
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { GENDERS, GENDER_LABELS, type Gender } from "@/shared/options";

export interface TermValues {
  original: string;
  translation: string;
  gender: Gender;
  note: string;
  alwaysUse: boolean;
}

const EMPTY: TermValues = { original: "", translation: "", gender: "none", note: "", alwaysUse: false };
const GENDER_ITEMS = GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }));

/** Adds or edits a glossary term. Render it only while it's open. */
export function TermDialog({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial?: TermValues;
  onSave: (values: TermValues) => Promise<unknown>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<TermValues>(() =>
    initial
      ? {
          original: initial.original,
          translation: initial.translation,
          gender: initial.gender,
          note: initial.note,
          alwaysUse: initial.alwaysUse,
        }
      : EMPTY,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (change: Partial<TermValues>) => setValues((current) => ({ ...current, ...change }));

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="term-original">Original</Label>
              <Input
                id="term-original"
                data-testid="term-original"
                value={values.original}
                onChange={(event) => set({ original: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="term-translation">Translation</Label>
              <Input
                id="term-translation"
                data-testid="term-translation"
                value={values.translation}
                onChange={(event) => set({ translation: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select
              items={GENDER_ITEMS}
              value={values.gender}
              onValueChange={(gender) => gender && set({ gender: gender as Gender })}
            >
              <SelectTrigger data-testid="term-gender" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-note">Note for the translator</Label>
            <Textarea
              id="term-note"
              data-testid="term-note"
              value={values.note}
              onChange={(event) => set({ note: event.target.value })}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="term-always"
              data-testid="term-always"
              checked={values.alwaysUse}
              onCheckedChange={(alwaysUse) => set({ alwaysUse })}
            />
            <Label htmlFor="term-always">Always use</Label>
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
            <Button type="submit" data-testid="term-save" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

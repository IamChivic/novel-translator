import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";
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
import { messageOf } from "@/client/lib/errors";
import { getTranslatePage, translateChapter } from "@/serverFunctions/translate";
import { MAX_SOURCE_CHARS, MODELS, type ModelId } from "@/shared/options";

export const Route = createFileRoute("/translate")({
  loader: () => getTranslatePage(),
  head: () => ({ meta: [{ title: "Translate · Novel Translator" }] }),
  component: TranslatePage,
});

const NEW_THREAD = "__new__";
const MODEL_ITEMS = MODELS.map((model) => ({ value: model.id, label: model.label }));

function TranslatePage() {
  const { threads, ai } = Route.useLoaderData();
  const navigate = useNavigate();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState(threads[0]?.id ?? NEW_THREAD);
  const [name, setName] = useState("");
  const [model, setModel] = useState<ModelId>(MODELS[0].id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = source.trim().length;
  const tooLong = length > MAX_SOURCE_CHARS;
  const destinationItems = [
    { value: NEW_THREAD, label: "New thread" },
    ...threads.map((thread) => ({ value: thread.id, label: thread.name })),
  ];

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await translateChapter({
        data: {
          source,
          model,
          ...(destination === NEW_THREAD
            ? name.trim()
              ? { newThreadName: name.trim() }
              : {}
            : { threadId: destination }),
        },
      });
      await navigate({
        to: "/threads/$threadId/chapters/$chapterId",
        params: { threadId: result.threadId, chapterId: result.chapterId },
      });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Translate" />
      {!ai.ready ? (
        <Alert data-testid="ai-off">
          <AlertTitle>Translation is off</AlertTitle>
          <AlertDescription>
            {ai.setup ?? "An admin needs to add an OpenRouter key to the Gateway."}
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="source-input">Chapter link or text</Label>
          <Textarea
            id="source-input"
            data-testid="source-input"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="https://… or the chapter in Chinese, Japanese or Korean"
            rows={10}
            className="bg-card"
          />
          <p
            data-testid="source-count"
            className={tooLong ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {length.toLocaleString("en-US")} / {MAX_SOURCE_CHARS.toLocaleString("en-US")} characters
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Thread</Label>
            <Select
              items={destinationItems}
              value={destination}
              onValueChange={(value) => value && setDestination(value)}
            >
              <SelectTrigger data-testid="destination-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {destinationItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select items={MODEL_ITEMS} value={model} onValueChange={(value) => value && setModel(value as ModelId)}>
              <SelectTrigger data-testid="model-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {destination === NEW_THREAD ? (
          <div className="space-y-1.5">
            <Label htmlFor="new-thread-name">Thread name</Label>
            <Input
              id="new-thread-name"
              data-testid="new-thread-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="From the chapter when left blank"
              className="bg-card"
            />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="translate-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          data-testid="translate-button"
          pending={pending}
          disabled={!ai.ready || length === 0 || tooLong}
        >
          {pending ? "Translating…" : "Translate"}
        </Button>
      </form>
    </AppShell>
  );
}

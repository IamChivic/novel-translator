import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chapters, defaultTerms, terms, threads } from "@/db/schema";
import { MAX_SOURCE_CHARS, MODEL_IDS } from "@/shared/options";
import { AiOffError, complete } from "./ai";
import { nextPosition, requireChapter } from "./chapters";
import { ensureMember, type Identity } from "./members";
import { NotFoundError, createThread, requireThread } from "./threads";
import {
  buildMessages,
  extractChapter,
  hasCjk,
  parseReply,
  termsForPrompt,
} from "./text";

const URL_PATTERN = /^https?:\/\/\S+$/i;
const TOO_LONG = `The chapter is over ${MAX_SOURCE_CHARS.toLocaleString("en-US")} characters.`;
const NO_CJK = "No Chinese, Japanese or Korean text found.";

export const translateInput = z
  .object({
    source: z
      .string()
      .trim()
      .min(1, "Paste a chapter link or its text")
      .max(MAX_SOURCE_CHARS, TOO_LONG),
    threadId: z.string().optional(),
    newThreadName: z.string().trim().max(200).optional(),
    model: z.enum(MODEL_IDS),
  })
  .strict();

/** Translates a link or pasted text into a new or existing thread. */
export async function translate(user: Identity, input: z.infer<typeof translateInput>) {
  const isUrl = URL_PATTERN.test(input.source);
  if (!isUrl && !hasCjk(input.source)) throw new Error(NO_CJK);
  if (isUrl) checkUrl(input.source);
  await ensureMember(user);
  let threadId = input.threadId;
  const named = Boolean(input.newThreadName);
  if (threadId) {
    await requireThread(user.id, threadId);
  } else {
    const fallback = isUrl ? new URL(input.source).hostname : "New thread";
    threadId = (await createThread(user.id, input.newThreadName || fallback)).id;
  }
  const chapterId = await addChapter(user.id, threadId, {
    model: input.model,
    sourceUrl: isUrl ? input.source : null,
    sourceText: isUrl ? "" : input.source,
  });
  await run(user, chapterId, { nameThread: !input.threadId && !named });
  return { threadId, chapterId };
}

async function addChapter(
  userId: string,
  threadId: string,
  values: { model: string; sourceUrl: string | null; sourceText: string },
) {
  const [chapter] = await db
    .insert(chapters)
    .values({
      id: crypto.randomUUID(),
      threadId,
      userId,
      position: await nextPosition(threadId),
      ...values,
    })
    .returning({ id: chapters.id });
  return chapter!.id;
}

export const retranslateInput = z
  .object({
    id: z.string(),
    model: z.enum(MODEL_IDS).optional(),
    text: z.string().trim().min(1).max(MAX_SOURCE_CHARS, TOO_LONG).optional(),
  })
  .strict();

/** Tries a failed chapter again or translates a done one again, optionally from pasted text. */
export async function retranslate(user: Identity, input: z.infer<typeof retranslateInput>) {
  const chapter = await requireChapter(user.id, input.id);
  if (input.text !== undefined && !hasCjk(input.text)) throw new Error(NO_CJK);
  await db
    .update(chapters)
    .set({
      ...(input.model ? { model: input.model } : {}),
      ...(input.text !== undefined ? { sourceText: input.text } : {}),
    })
    .where(and(eq(chapters.id, chapter.id), eq(chapters.userId, user.id)));
  await run(user, chapter.id, { nameThread: false });
  return { threadId: chapter.threadId, chapterId: chapter.id };
}

/**
 * The chapter after this one: the next in the thread's order, or else the
 * link the page pointed to, translated into the thread.
 */
export async function nextChapter(user: Identity, id: string) {
  const chapter = await requireChapter(user.id, id);
  const order = await db
    .select({ id: chapters.id, sourceUrl: chapters.sourceUrl })
    .from(chapters)
    .where(and(eq(chapters.threadId, chapter.threadId), eq(chapters.userId, user.id)))
    .orderBy(asc(chapters.position), asc(chapters.createdAt));
  const index = order.findIndex((row) => row.id === id);
  const next = order[index + 1];
  if (next) return { threadId: chapter.threadId, chapterId: next.id };
  if (!chapter.nextUrl) throw new NotFoundError("There is no next chapter");
  const existing = order.find((row) => row.sourceUrl === chapter.nextUrl);
  if (existing) return { threadId: chapter.threadId, chapterId: existing.id };
  checkUrl(chapter.nextUrl);
  const chapterId = await addChapter(user.id, chapter.threadId, {
    model: chapter.model,
    sourceUrl: chapter.nextUrl,
    sourceText: "",
  });
  await run(user, chapterId, { nameThread: false });
  return { threadId: chapter.threadId, chapterId };
}

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i;

function checkUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That link isn't a web address.");
  }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) {
    throw new Error("That link can't be read.");
  }
}

class ChapterFailure extends Error {}

async function fetchPage(url: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; chapter reader)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ChapterFailure("Couldn't reach the page. Paste the chapter text instead.");
  }
  if (!response.ok) {
    throw new ChapterFailure(
      `The site refused the request (${response.status}). Paste the chapter text instead.`,
    );
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5_000_000) throw new ChapterFailure("The page is too large to read.");
  const header = response.headers.get("content-type") ?? "";
  const head = new TextDecoder().decode(bytes.slice(0, 4096));
  const charset =
    /charset=([\w-]+)/i.exec(header)?.[1] ??
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    html = new TextDecoder().decode(bytes);
  }
  const chapter = extractChapter(html, response.url || url);
  if (!chapter.text) {
    throw new ChapterFailure(
      "No Chinese, Japanese or Korean chapter text was found on that page. Paste the text instead.",
    );
  }
  return chapter;
}

function now() {
  return new Date().toISOString();
}

async function run(user: Identity, chapterId: string, { nameThread }: { nameThread: boolean }) {
  const member = await ensureMember(user);
  const chapter = await requireChapter(user.id, chapterId);
  const thread = await requireThread(user.id, chapter.threadId);
  const own = and(eq(chapters.id, chapterId), eq(chapters.userId, user.id));
  await db
    .update(chapters)
    .set({ status: "translating", failureReason: null, updatedAt: now() })
    .where(own);
  try {
    let { sourceText, title, nextUrl } = chapter;
    if (!sourceText && chapter.sourceUrl) {
      const page = await fetchPage(chapter.sourceUrl);
      sourceText = page.text;
      title = title || page.title;
      nextUrl = page.nextUrl;
      await db.update(chapters).set({ sourceText, title, nextUrl }).where(own);
    }
    if (sourceText.length > MAX_SOURCE_CHARS) throw new ChapterFailure(TOO_LONG);
    if (!hasCjk(sourceText)) throw new ChapterFailure(NO_CJK);

    // The member's defaults that this chapter uses join the thread's glossary.
    const defaults = (
      await db.select().from(defaultTerms).where(eq(defaultTerms.userId, user.id))
    ).filter((term) => sourceText.includes(term.original));
    for (const term of defaults) {
      const values = {
        translation: term.translation,
        gender: term.gender,
        note: term.note,
        alwaysUse: term.alwaysUse,
        source: "default",
      };
      await db
        .insert(terms)
        .values({ id: crypto.randomUUID(), threadId: thread.id, userId: user.id, original: term.original, ...values })
        .onConflictDoUpdate({
          target: [terms.threadId, terms.original],
          set: values,
          setWhere: eq(terms.source, "auto"),
        });
    }
    const glossary = await db
      .select()
      .from(terms)
      .where(and(eq(terms.threadId, thread.id), eq(terms.userId, user.id)));
    const instruction = thread.instruction ?? member.defaultInstruction;
    const messages = buildMessages({
      title: chapter.sourceUrl ? title : "",
      text: sourceText,
      terms: termsForPrompt(glossary, sourceText),
      instruction,
    });
    const reply = parseReply(await complete(chapter.model, messages));

    if (member.findNewTerms) {
      for (const term of reply.terms) {
        await db
          .insert(terms)
          .values({
            id: crypto.randomUUID(),
            threadId: thread.id,
            userId: user.id,
            original: term.original,
            translation: term.translation,
            autoTranslation: term.translation,
            gender: term.gender,
            note: term.note,
            source: "auto",
          })
          .onConflictDoUpdate({
            target: [terms.threadId, terms.original],
            set: { autoTranslation: sql`coalesce(${terms.autoTranslation}, excluded.auto_translation)` },
          });
      }
    }
    const wording = await db
      .select({ original: terms.original, translation: terms.translation, excluded: terms.excluded })
      .from(terms)
      .where(and(eq(terms.threadId, thread.id), eq(terms.userId, user.id)));
    const used = Object.fromEntries(
      wording.filter((term) => !term.excluded).map((term) => [term.original, term.translation]),
    );
    const finalTitle = chapter.title || reply.title || title || firstLine(sourceText);
    await db.batch([
      db
        .update(chapters)
        .set({
          status: "done",
          translation: reply.translation,
          title: finalTitle,
          termsUsed: JSON.stringify(used),
          failureReason: null,
          updatedAt: now(),
        })
        .where(own),
      db
        .update(threads)
        .set({
          lastTranslatedAt: now(),
          ...(nameThread && reply.title ? { name: reply.title } : {}),
        })
        .where(and(eq(threads.id, thread.id), eq(threads.userId, user.id))),
    ]);
  } catch (error) {
    const reason =
      error instanceof AiOffError
        ? "Translation isn't set up on this Gateway yet."
        : error instanceof Error
          ? error.message
          : "The translation failed.";
    await db
      .update(chapters)
      .set({ status: "failed", failureReason: reason, updatedAt: now() })
      .where(own);
  }
}

function firstLine(text: string): string {
  return (text.split("\n").find((line) => line.trim()) ?? "").trim().slice(0, 80);
}

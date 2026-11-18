// Pure text work: reading a chapter out of a web page, the prompt, the
// model's reply, and showing changed glossary wording. No bindings here, so
// unit tests run it directly.

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/;

export function hasCjk(text: string): boolean {
  return CJK.test(text);
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  mdash: "—",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const value =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000
        ? String.fromCodePoint(value)
        : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/[ \t 　]+/g, " ")
    .trim();
}

/** The block of HTML from `start` to the end of the element opened there. */
function elementAt(html: string, start: number): string {
  const tag = /<(\/?)(div|article|section|main)\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.lastIndex);
  }
  return html.slice(start);
}

const NAV_LINE =
  /^(上一[章页頁]|下一[章页頁]|目录|目錄|返回|书签|書籤|前へ|次へ|目次|이전|다음|목록)/;

function linesOf(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|section|article)>/gi, "\n")
    .split("\n")
    .map(stripTags)
    .filter((line) => line.length > 0 && !(line.length < 12 && NAV_LINE.test(line)));
}

const NEXT_TEXT =
  /^(下一[章页頁节節]|下[章页頁]|次へ|次の話|次話|次のエピソード|다음\s*화|다음화|다음\s*편|다음|next( chapter)?)\s*[>»→]*$/i;

export interface ExtractedChapter {
  title: string;
  text: string;
  nextUrl: string | null;
}

/** The chapter's title, its text and the link to the next chapter, from a page's HTML. */
export function extractChapter(html: string, pageUrl: string): ExtractedChapter {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1>/gi, "");

  let nextUrl: string | null = null;
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (let match = anchor.exec(cleaned); match; match = anchor.exec(cleaned)) {
    const attributes = match[1]!;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    if (!href) continue;
    const label = stripTags(match[2]!);
    if (/\brel\s*=\s*["'][^"']*\bnext\b/i.test(attributes) || NEXT_TEXT.test(label)) {
      try {
        const url = new URL(decodeEntities(href), pageUrl);
        if (url.protocol === "http:" || url.protocol === "https:") {
          url.hash = "";
          nextUrl = url.toString();
          break;
        }
      } catch {
        // Not a link: keep looking.
      }
    }
  }

  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(cleaned)?.[1];
  const pageTitle = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(cleaned)?.[1];
  const title = stripTags(heading ?? pageTitle ?? "").slice(0, 200);

  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(cleaned)?.[1] ?? cleaned;
  const withoutChrome = body.replace(
    /<(nav|header|footer|aside|form|button|select)\b[\s\S]*?<\/\1>/gi,
    "",
  );
  const container =
    /<(div|article|section|main)\b[^>]*\b(id|class)\s*=\s*["'][^"']*(chapter-?content|chaptercontent|content|chapter|article|txt|text|read|novel|episode|viewer)[^"']*["'][^>]*>/i;
  let best: string[] = [];
  const candidates = new RegExp(container.source, "gi");
  for (let match = candidates.exec(withoutChrome); match; match = candidates.exec(withoutChrome)) {
    const lines = linesOf(elementAt(withoutChrome, match.index)).filter(hasCjk);
    if (lines.join("").length > best.join("").length) best = lines;
  }
  if (best.length === 0) {
    const all = linesOf(withoutChrome).filter(hasCjk);
    if (all.join("").length > best.join("").length) best = all;
  }
  if (best[0] && title && best[0] === title) best = best.slice(1);
  return { title, text: best.join("\n\n"), nextUrl };
}

export interface PromptTerm {
  original: string;
  translation: string;
  gender: string;
  note: string;
  alwaysUse: boolean;
}

export function glossaryLine(term: PromptTerm): string {
  let line = `- ${term.original} → ${term.translation}`;
  if (term.gender === "male" || term.gender === "female") line += ` [${term.gender}]`;
  if (term.alwaysUse) line += " (mandatory)";
  if (term.note.trim()) line += ` — ${term.note.trim()}`;
  return line;
}

/** The terms worth sending: those in the text, and every always-use one. */
export function termsForPrompt<T extends PromptTerm & { excluded: boolean }>(
  terms: T[],
  source: string,
): T[] {
  return terms.filter(
    (term) => !term.excluded && (term.alwaysUse || source.includes(term.original)),
  );
}

export function buildMessages({
  title,
  text,
  terms,
  instruction,
}: {
  title: string;
  text: string;
  terms: PromptTerm[];
  instruction: string;
}): { role: "system" | "user"; content: string }[] {
  const parts = [
    "You translate web-novel chapters written in Chinese, Japanese or Korean into natural, readable English.",
    "Translate the whole chapter faithfully, paragraph by paragraph, keeping the paragraph breaks.",
    'Answer with one JSON object and nothing else: {"title": string, "translation": string, "terms": [{"original": string, "translation": string, "gender": "none" | "male" | "female", "note": string}]}.',
    '"title" is the chapter title in English. "terms" lists the names of people, places, sects, techniques, items and titles that appear in this chapter, with the English you used for each.',
  ];
  if (terms.length > 0) {
    parts.push(
      "Glossary. Use these translations; terms marked (mandatory) must be used exactly as given:",
      terms.map(glossaryLine).join("\n"),
    );
  }
  if (instruction.trim()) {
    parts.push("The reader's instruction:", instruction.trim());
  }
  const user = title ? `Chapter title: ${title}\n\n${text}` : text;
  return [
    { role: "system", content: parts.join("\n\n") },
    { role: "user", content: user },
  ];
}

export interface ModelTerm {
  original: string;
  translation: string;
  gender: "none" | "male" | "female";
  note: string;
}

export interface ModelReply {
  title: string;
  translation: string;
  terms: ModelTerm[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The model's answer as a title, a translation and its term list. */
export function parseReply(content: string): ModelReply {
  const unfenced = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
      const translation = asString(parsed["translation"]);
      if (translation) {
        const terms = Array.isArray(parsed["terms"]) ? parsed["terms"] : [];
        return {
          title: asString(parsed["title"]).slice(0, 200),
          translation,
          terms: terms
            .map((raw) => {
              const term = (raw ?? {}) as Record<string, unknown>;
              const gender = asString(term["gender"]).toLowerCase();
              return {
                original: asString(term["original"]).slice(0, 100),
                translation: asString(term["translation"]).slice(0, 200),
                gender: gender === "male" || gender === "female" ? gender : "none",
                note: asString(term["note"]).slice(0, 500),
              } satisfies ModelTerm;
            })
            .filter((term) => term.original && term.translation)
            .slice(0, 200),
        };
      }
    } catch {
      // Not JSON after all: the text is the translation.
    }
  }
  return { title: "", translation: content.trim(), terms: [] };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `to` in the case the matched text was written in. */
function inCaseOf(match: string, to: string): string {
  const letters = match.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return to.toUpperCase();
  }
  if (letters.length > 0 && letters === letters.toLowerCase() && letters !== letters.toUpperCase()) {
    return to.toLowerCase();
  }
  const first = match.charAt(0);
  if (first !== first.toLowerCase()) return to.charAt(0).toUpperCase() + to.slice(1);
  return to;
}

/** Every whole-word `from` in `text` replaced by `to`, in the case each was written in. */
export function replaceWording(text: string, from: string, to: string): string {
  if (!from || from === to) return text;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(from)}(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return text.replace(pattern, (match) => inCaseOf(match, to));
}

/**
 * A stored translation with the glossary's current wording: each term whose
 * translation changed since the chapter was translated is swapped in.
 */
export function withCurrentWording(
  translation: string,
  used: Record<string, string>,
  current: { original: string; translation: string }[],
): string {
  const changes = current
    .map((term) => ({ from: used[term.original] ?? "", to: term.translation }))
    .filter((change) => change.from && change.to && change.from !== change.to)
    .sort((a, b) => b.from.length - a.from.length);
  if (changes.length === 0) return translation;
  // One pass, longest first, so one change never rewrites another's result.
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${changes.map((change) => escapeRegExp(change.from)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return translation.replace(pattern, (match) => {
    const change = changes.find(
      (candidate) => candidate.from.toLowerCase() === match.toLowerCase(),
    );
    return change ? inCaseOf(match, change.to) : match;
  });
}

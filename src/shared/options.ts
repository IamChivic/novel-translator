// Fixed choices shared by the pages and the server.

export const MODELS = [
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];
export const MODEL_IDS = MODELS.map((model) => model.id) as [
  ModelId,
  ...ModelId[],
];
export function modelLabel(id: string): string {
  return MODELS.find((model) => model.id === id)?.label ?? id;
}

export const MAX_SOURCE_CHARS = 20_000;
export const MAX_TAGS = 16;
export const MAX_TAG_LENGTH = 32;

export const THREAD_STATUSES = ["reading", "completed", "dropped"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];
export const THREAD_STATUS_LABELS: Record<ThreadStatus, string> = {
  reading: "Reading",
  completed: "Completed",
  dropped: "Dropped",
};

export const GENDERS = ["none", "male", "female"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  none: "None",
  male: "Male",
  female: "Female",
};

export const TERM_SOURCES = ["auto", "user", "default"] as const;
export type TermSource = (typeof TERM_SOURCES)[number];
export const TERM_SOURCE_LABELS: Record<TermSource, string> = {
  auto: "Auto",
  user: "Set by you",
  default: "Your default",
};

export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
export const READING_WIDTHS = ["narrow", "medium", "wide"] as const;
export const FONT_FAMILIES = ["sans", "serif", "mono"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export type ReadingWidth = (typeof READING_WIDTHS)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];

export type ChapterStatus = "translating" | "done" | "failed";

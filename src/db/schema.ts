import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** One row per member, keyed by the Gateway's user id: their defaults and preferences. */
export const members = sqliteTable("members", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  defaultInstruction: text("default_instruction").notNull().default(""),
  findNewTerms: integer("find_new_terms", { mode: "boolean" })
    .notNull()
    .default(true),
  liveTermUpdates: integer("live_term_updates", { mode: "boolean" })
    .notNull()
    .default(true),
  textSize: text("text_size").notNull().default("md"),
  readingWidth: text("reading_width").notNull().default("medium"),
  fontFamily: text("font_family").notNull().default("sans"),
  createdAt: text("created_at").notNull().default(now),
});

export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("reading"),
    /** JSON array of strings. */
    tags: text("tags").notNull().default("[]"),
    note: text("note").notNull().default(""),
    /** Null: the member's default instruction applies. */
    instruction: text("instruction"),
    shareToken: text("share_token").unique(),
    lastReadChapterId: text("last_read_chapter_id"),
    lastTranslatedAt: text("last_translated_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [index("threads_user_idx").on(table.userId)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull().default(""),
    sourceUrl: text("source_url"),
    sourceText: text("source_text").notNull().default(""),
    translation: text("translation").notNull().default(""),
    model: text("model").notNull(),
    status: text("status").notNull().default("translating"),
    failureReason: text("failure_reason"),
    nextUrl: text("next_url"),
    /** JSON object: each glossary original and the wording it had when translated. */
    termsUsed: text("terms_used").notNull().default("{}"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    bookmarked: integer("bookmarked", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [index("chapters_thread_idx").on(table.threadId, table.position)],
);

export const terms = sqliteTable(
  "terms",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id").notNull(),
    original: text("original").notNull(),
    translation: text("translation").notNull(),
    /** What the model last proposed, for "Reset to auto". */
    autoTranslation: text("auto_translation"),
    gender: text("gender").notNull().default("none"),
    note: text("note").notNull().default(""),
    alwaysUse: integer("always_use", { mode: "boolean" })
      .notNull()
      .default(false),
    excluded: integer("excluded", { mode: "boolean" }).notNull().default(false),
    /** auto, user or default. */
    source: text("source").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("terms_thread_original_idx").on(table.threadId, table.original),
  ],
);

export const defaultTerms = sqliteTable(
  "default_terms",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    original: text("original").notNull(),
    translation: text("translation").notNull(),
    gender: text("gender").notNull().default("none"),
    note: text("note").notNull().default(""),
    alwaysUse: integer("always_use", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("default_terms_user_original_idx").on(
      table.userId,
      table.original,
    ),
  ],
);

CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`source_url` text,
	`source_text` text DEFAULT '' NOT NULL,
	`translation` text DEFAULT '' NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'translating' NOT NULL,
	`failure_reason` text,
	`next_url` text,
	`terms_used` text DEFAULT '{}' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`bookmarked` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chapters_thread_idx` ON `chapters` (`thread_id`,`position`);--> statement-breakpoint
CREATE TABLE `default_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original` text NOT NULL,
	`translation` text NOT NULL,
	`gender` text DEFAULT 'none' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`always_use` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `default_terms_user_original_idx` ON `default_terms` (`user_id`,`original`);--> statement-breakpoint
CREATE TABLE `members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`default_instruction` text DEFAULT '' NOT NULL,
	`find_new_terms` integer DEFAULT true NOT NULL,
	`live_term_updates` integer DEFAULT true NOT NULL,
	`text_size` text DEFAULT 'md' NOT NULL,
	`reading_width` text DEFAULT 'medium' NOT NULL,
	`font_family` text DEFAULT 'sans' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`original` text NOT NULL,
	`translation` text NOT NULL,
	`auto_translation` text,
	`gender` text DEFAULT 'none' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`always_use` integer DEFAULT false NOT NULL,
	`excluded` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_thread_original_idx` ON `terms` (`thread_id`,`original`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'reading' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`instruction` text,
	`share_token` text,
	`last_read_chapter_id` text,
	`last_translated_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `threads_share_token_unique` ON `threads` (`share_token`);--> statement-breakpoint
CREATE INDEX `threads_user_idx` ON `threads` (`user_id`);
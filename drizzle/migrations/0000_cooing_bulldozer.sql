CREATE TABLE `benchmark_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_version_id` text NOT NULL,
	`model_id` text NOT NULL,
	`harness_version_id` text NOT NULL,
	`effort_preset_id` text NOT NULL,
	`source_id` text NOT NULL,
	`source_run_id` text NOT NULL,
	`n_solved` integer NOT NULL,
	`n_total` integer NOT NULL,
	`solve_rate` real NOT NULL,
	`cost_usd_reported` real,
	`cost_usd_normalized` real,
	`cost_per_task_reported` real,
	`cost_per_task_normalized` real,
	`has_tokens` integer DEFAULT 0 NOT NULL,
	`has_cost` integer DEFAULT 0 NOT NULL,
	`has_latency` integer DEFAULT 0 NOT NULL,
	`has_pass_at_k` integer DEFAULT 0 NOT NULL,
	`has_ci` integer DEFAULT 0 NOT NULL,
	`pass_at_k` text DEFAULT '{}' NOT NULL,
	`latency_p50_seconds` real,
	`tokens_in` integer,
	`tokens_out` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`benchmark_version_id`) REFERENCES `benchmark_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`harness_version_id`) REFERENCES `harness_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`effort_preset_id`) REFERENCES `effort_presets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_run_unique_idx` ON `benchmark_runs` (`source_id`,`source_run_id`);--> statement-breakpoint
CREATE INDEX `benchmark_version_idx_runs` ON `benchmark_runs` (`benchmark_version_id`);--> statement-breakpoint
CREATE INDEX `model_idx_runs` ON `benchmark_runs` (`model_id`);--> statement-breakpoint
CREATE INDEX `harness_version_idx_runs` ON `benchmark_runs` (`harness_version_id`);--> statement-breakpoint
CREATE INDEX `effort_preset_idx_runs` ON `benchmark_runs` (`effort_preset_id`);--> statement-breakpoint
CREATE TABLE `benchmark_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_id` text NOT NULL,
	`version` text NOT NULL,
	`n_tasks` integer NOT NULL,
	FOREIGN KEY (`benchmark_id`) REFERENCES `benchmarks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_version_idx` ON `benchmark_versions` (`benchmark_id`,`version`);--> statement-breakpoint
CREATE TABLE `benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmarks_slug_unique` ON `benchmarks` (`slug`);--> statement-breakpoint
CREATE TABLE `effort_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `effort_presets_slug_unique` ON `effort_presets` (`slug`);--> statement-breakpoint
CREATE TABLE `harness_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`harness_id` text NOT NULL,
	`version` text NOT NULL,
	FOREIGN KEY (`harness_id`) REFERENCES `harnesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `harness_version_idx` ON `harness_versions` (`harness_id`,`version`);--> statement-breakpoint
CREATE TABLE `harnesses` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `harnesses_slug_unique` ON `harnesses` (`slug`);--> statement-breakpoint
CREATE TABLE `ingest_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`summary` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `model_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`alias` text NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_aliases_alias_unique` ON `model_aliases` (`alias`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_slug_unique` ON `models` (`slug`);--> statement-breakpoint
CREATE TABLE `pricing_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`prompt_per_1m` real,
	`completion_per_1m` real,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_slug_unique` ON `providers` (`slug`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`official` integer DEFAULT 0 NOT NULL,
	`url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_slug_unique` ON `sources` (`slug`);
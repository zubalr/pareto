import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull().references(() => providers.id),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const modelAliases = sqliteTable("model_aliases", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull().references(() => models.id),
  alias: text("alias").notNull().unique(),
});

export const harnesses = sqliteTable("harnesses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const harnessVersions = sqliteTable(
  "harness_versions",
  {
    id: text("id").primaryKey(),
    harnessId: text("harness_id").notNull().references(() => harnesses.id),
    version: text("version").notNull(),
  },
  (table) => [
    uniqueIndex("harness_version_idx").on(table.harnessId, table.version),
  ]
);

export const benchmarks = sqliteTable("benchmarks", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const benchmarkVersions = sqliteTable(
  "benchmark_versions",
  {
    id: text("id").primaryKey(),
    benchmarkId: text("benchmark_id").notNull().references(() => benchmarks.id),
    version: text("version").notNull(),
    nTasks: integer("n_tasks").notNull(),
  },
  (table) => [
    uniqueIndex("benchmark_version_idx").on(table.benchmarkId, table.version),
  ]
);

export const effortPresets = sqliteTable("effort_presets", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const pricingSnapshots = sqliteTable("pricing_snapshots", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull().references(() => models.id),
  snapshotDate: text("snapshot_date").notNull(),
  promptPer1m: real("prompt_per_1m"),
  completionPer1m: real("completion_per_1m"),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  official: integer("official").notNull().default(0),
  url: text("url"),
});

export const benchmarkRuns = sqliteTable(
  "benchmark_runs",
  {
    id: text("id").primaryKey(),
    benchmarkVersionId: text("benchmark_version_id")
      .notNull()
      .references(() => benchmarkVersions.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    harnessVersionId: text("harness_version_id")
      .notNull()
      .references(() => harnessVersions.id),
    effortPresetId: text("effort_preset_id")
      .notNull()
      .references(() => effortPresets.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    sourceRunId: text("source_run_id").notNull(),
    nSolved: integer("n_solved").notNull(),
    nTotal: integer("n_total").notNull(),
    solveRate: real("solve_rate").notNull(),
    costUsdReported: real("cost_usd_reported"),
    costUsdNormalized: real("cost_usd_normalized"),
    costPerTaskReported: real("cost_per_task_reported"),
    costPerTaskNormalized: real("cost_per_task_normalized"),
    hasTokens: integer("has_tokens").notNull().default(0),
    hasCost: integer("has_cost").notNull().default(0),
    hasLatency: integer("has_latency").notNull().default(0),
    hasPassAtK: integer("has_pass_at_k").notNull().default(0),
    hasCi: integer("has_ci").notNull().default(0),
    passAtK: text("pass_at_k").notNull().default("{}"),
    latencyP50Seconds: real("latency_p50_seconds"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("source_run_unique_idx").on(table.sourceId, table.sourceRunId),
    index("benchmark_version_idx_runs").on(table.benchmarkVersionId),
    index("model_idx_runs").on(table.modelId),
    index("harness_version_idx_runs").on(table.harnessVersionId),
    index("effort_preset_idx_runs").on(table.effortPresetId),
  ]
);

export const ingestJobs = sqliteTable("ingest_jobs", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => sources.id),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  summary: text("summary"),
});

export type Provider = typeof providers.$inferSelect;
export type Model = typeof models.$inferSelect;
export type ModelAlias = typeof modelAliases.$inferSelect;
export type Harness = typeof harnesses.$inferSelect;
export type HarnessVersion = typeof harnessVersions.$inferSelect;
export type Benchmark = typeof benchmarks.$inferSelect;
export type BenchmarkVersion = typeof benchmarkVersions.$inferSelect;
export type EffortPreset = typeof effortPresets.$inferSelect;
export type PricingSnapshot = typeof pricingSnapshots.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;
export type IngestJob = typeof ingestJobs.$inferSelect;

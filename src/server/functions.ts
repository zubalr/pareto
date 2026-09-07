import { createServerFn } from "@tanstack/react-start";
import { getDb, getKv } from "../db";
import {
  benchmarks,
  benchmarkVersions,
  benchmarkRuns,
  models,
  providers,
  harnesses,
  harnessVersions,
  effortPresets,
  sources,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { dominate, knee, Point } from "../metrics";
import type { FinderCandidate } from "../finder";
import { selectCompareRuns } from "../compare";

export type {
  ExplorerRun,
  FilterOption,
  BenchmarkOption,
  ExplorerResponse,
  ExplorerInput,
} from "./explorer-service";
import {
  fetchExplorerData,
  type ExplorerInput,
  type ExplorerResponse,
  type BenchmarkOption,
} from "./explorer-service";

export const getExplorerData = createServerFn()
  .validator((input: ExplorerInput) => input)
  .handler(async ({ data }): Promise<ExplorerResponse> => {
    return fetchExplorerData(data);
  });

// ---------------------------------------------------------------------------
// Finder — deterministic budget filter over one benchmark version.
// Read-only D1 (no KV writes); selection logic lives in src/finder.ts.
// Prices are the Reported basis: a cap in Today-basis dollars cannot be checked
// honestly until normalized pricing covers every row.
// ---------------------------------------------------------------------------

export interface FinderResponse {
  benchmarkOptions: BenchmarkOption[];
  currentBenchmark: BenchmarkOption | null;
  candidates: FinderCandidate[];
  error: string | null;
}

export const getFinderData = createServerFn()
  .validator((input: {
    benchmarkVersionId?: string;
    costBasis?: "reported" | "today";
    effortMatch?: "all" | "max" | "xhigh";
  }) => input)
  .handler(async ({ data }): Promise<FinderResponse> => {
    try {
      const db = getDb();

      const rawBenchmarks = await db
        .select({
          benchmarkVersionId: benchmarkVersions.id,
          benchmarkSlug: benchmarks.slug,
          benchmarkName: benchmarks.name,
          version: benchmarkVersions.version,
          nTasks: benchmarkVersions.nTasks,
        })
        .from(benchmarkVersions)
        .innerJoin(benchmarks, eq(benchmarkVersions.benchmarkId, benchmarks.id));

      const benchmarkOptions: BenchmarkOption[] = rawBenchmarks.map((b) => ({
        id: b.benchmarkVersionId,
        benchmarkSlug: b.benchmarkSlug,
        benchmarkName: b.benchmarkName,
        version: b.version,
        nTasks: b.nTasks,
        displayLabel: `${b.benchmarkName} ${b.version} (${b.nTasks} tasks)`,
      }));

      const activeBenchmark =
        benchmarkOptions.find(
          (b) => b.id === data.benchmarkVersionId || b.benchmarkSlug === data.benchmarkVersionId
        ) ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "deepswe" && b.version === "1.1") ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "terminal-bench" && b.version === "4.0") ||
        benchmarkOptions[0] ||
        null;

      if (!activeBenchmark) {
        return { benchmarkOptions: [], currentBenchmark: null, candidates: [], error: "No benchmarks found in database." };
      }

      const rows = await db
        .select({
          run: benchmarkRuns,
          model: models,
          provider: providers,
          harness: harnesses,
          harnessVer: harnessVersions,
          effort: effortPresets,
          source: sources,
        })
        .from(benchmarkRuns)
        .innerJoin(models, eq(benchmarkRuns.modelId, models.id))
        .innerJoin(providers, eq(models.providerId, providers.id))
        .innerJoin(harnessVersions, eq(benchmarkRuns.harnessVersionId, harnessVersions.id))
        .innerJoin(harnesses, eq(harnessVersions.harnessId, harnesses.id))
        .innerJoin(effortPresets, eq(benchmarkRuns.effortPresetId, effortPresets.id))
        .innerJoin(sources, eq(benchmarkRuns.sourceId, sources.id))
        .where(eq(benchmarkRuns.benchmarkVersionId, activeBenchmark.id));

      const basisToday = data.costBasis === "today";
      const effortMatchSlug =
        data.effortMatch && data.effortMatch !== "all" ? data.effortMatch : null;
      const candidates = rows
        .filter(
          (r) => effortMatchSlug === null || r.effort.slug === effortMatchSlug
        )
        .map((r) => ({
        id: r.run.id,
        sourceRunId: r.run.sourceRunId,
        modelDisplayName: r.model.displayName,
        modelSlug: r.model.slug,
        harnessName: r.harness.name,
        harnessVersion: r.harnessVer.version,
        effortPresetSlug: r.effort.slug,
        solveRate: r.run.solveRate,
        // Today basis = normalized price only; missing restated pricing stays
        // null so the run is excluded rather than silently repriced from reported.
        cost: basisToday ? r.run.costPerTaskNormalized : r.run.costPerTaskReported,
        costUsdTotal: basisToday ? r.run.costUsdNormalized : r.run.costUsdReported,
        nSolved: r.run.nSolved,
        latencyP50Seconds: r.run.latencyP50Seconds,
        sourceName: r.source.name,
        sourceOfficial: Boolean(r.source.official),
      }));

      return {
        benchmarkOptions,
        currentBenchmark: activeBenchmark,
        candidates,
        error: null,
      };
    } catch (err: any) {
      return {
        benchmarkOptions: [],
        currentBenchmark: null,
        candidates: [],
        error: err?.message || "Failed to load catalog data from D1.",
      };
    }
  });

// ---------------------------------------------------------------------------
// Model page — one base model across harnesses/efforts on one benchmark version.
// Read-only D1; frontier/knee decoration is computed bench-wide so the model's
// runs can be shown in context. Reported cost basis.
// ---------------------------------------------------------------------------

export interface ModelBenchEntry {
  benchmarkVersionId: string;
  benchmarkName: string;
  version: string;
  nTasks: number;
  runs: number;
  bestSolve: number;
  cheapestPerTask: number | null;
  effortPresets: string[];
}

export interface ModelPageResponse {
  benchmarkOptions: BenchmarkOption[];
  currentBenchmark: BenchmarkOption | null;
  model: { id: string; slug: string; displayName: string; providerName: string } | null;
  runs: ExplorerRun[];
  benchFrontier: Array<{ cost: number; solveRate: number }>;
  benchRunCount: number;
  /** Every benchmark version this slug appears on — never mixed into one scatter. */
  index: ModelBenchEntry[];
  error: string | null;
}

export const getModelData = createServerFn()
  .validator((input: { slug: string; benchmarkVersionId?: string }) => input)
  .handler(async ({ data }): Promise<ModelPageResponse> => {
    try {
      const db = getDb();

      const rawBenchmarks = await db
        .select({
          benchmarkVersionId: benchmarkVersions.id,
          benchmarkSlug: benchmarks.slug,
          benchmarkName: benchmarks.name,
          version: benchmarkVersions.version,
          nTasks: benchmarkVersions.nTasks,
        })
        .from(benchmarkVersions)
        .innerJoin(benchmarks, eq(benchmarkVersions.benchmarkId, benchmarks.id));

      const benchmarkOptions: BenchmarkOption[] = rawBenchmarks.map((b) => ({
        id: b.benchmarkVersionId,
        benchmarkSlug: b.benchmarkSlug,
        benchmarkName: b.benchmarkName,
        version: b.version,
        nTasks: b.nTasks,
        displayLabel: `${b.benchmarkName} ${b.version} (${b.nTasks} tasks)`,
      }));

      const activeBenchmark =
        benchmarkOptions.find(
          (b) => b.id === data.benchmarkVersionId || b.benchmarkSlug === data.benchmarkVersionId
        ) ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "deepswe" && b.version === "1.1") ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "terminal-bench" && b.version === "4.0") ||
        benchmarkOptions[0] ||
        null;

      if (!activeBenchmark) {
        return { benchmarkOptions: [], currentBenchmark: null, model: null, runs: [], benchFrontier: [], benchRunCount: 0, index: [], error: "No benchmarks found in database." };
      }

      const rows = await db
        .select({
          run: benchmarkRuns,
          model: models,
          provider: providers,
          harness: harnesses,
          harnessVer: harnessVersions,
          effort: effortPresets,
          source: sources,
        })
        .from(benchmarkRuns)
        .innerJoin(models, eq(benchmarkRuns.modelId, models.id))
        .innerJoin(providers, eq(models.providerId, providers.id))
        .innerJoin(harnessVersions, eq(benchmarkRuns.harnessVersionId, harnessVersions.id))
        .innerJoin(harnesses, eq(harnessVersions.harnessId, harnesses.id))
        .innerJoin(effortPresets, eq(benchmarkRuns.effortPresetId, effortPresets.id))
        .innerJoin(sources, eq(benchmarkRuns.sourceId, sources.id))
        .where(eq(benchmarkRuns.benchmarkVersionId, activeBenchmark.id));

      // Bench-wide frontier/knee context (reported basis), then filter to the model.
      const mapped: ExplorerRun[] = rows.map((r) => ({
        id: r.run.id,
        sourceRunId: r.run.sourceRunId,
        modelId: r.model.id,
        modelSlug: r.model.slug,
        modelDisplayName: r.model.displayName,
        providerName: r.provider.name,
        harnessId: r.harness.id,
        harnessName: r.harness.name,
        harnessVersionId: r.harnessVer.id,
        harnessVersion: r.harnessVer.version,
        effortPresetId: r.effort.id,
        effortPresetSlug: r.effort.slug,
        sourceId: r.source.id,
        sourceName: r.source.name,
        sourceOfficial: Boolean(r.source.official),
        nSolved: r.run.nSolved,
        nTotal: r.run.nTotal,
        solveRate: r.run.solveRate,
        costUsdReported: r.run.costUsdReported,
        costUsdNormalized: r.run.costUsdNormalized,
        costPerTaskReported: r.run.costPerTaskReported,
        costPerTaskNormalized: r.run.costPerTaskNormalized,
        cost: r.run.costPerTaskReported,
        hasTokens: Boolean(r.run.hasTokens),
        hasCost: Boolean(r.run.hasCost),
        hasLatency: Boolean(r.run.hasLatency),
        hasPassAtK: Boolean(r.run.hasPassAtK),
        hasCi: Boolean(r.run.hasCi),
        passAtK: r.run.passAtK,
        latencyP50Seconds: r.run.latencyP50Seconds,
        tokensIn: r.run.tokensIn,
        tokensOut: r.run.tokensOut,
      }));

      const { frontier } = dominate(mapped, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });
      const kneePoint = knee(frontier, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });
      const frontierIds = new Set(frontier.map((f) => f.id));

      const decorated = mapped.map((run) => ({
        ...run,
        isFrontier: frontierIds.has(run.id),
        isKnee: kneePoint ? run.id === kneePoint.id : false,
      }));

      const modelRuns = decorated.filter((r) => r.modelSlug === data.slug);
      const model = modelRuns.length > 0
        ? {
            id: modelRuns[0].modelId,
            slug: modelRuns[0].modelSlug,
            displayName: modelRuns[0].modelDisplayName,
            providerName: modelRuns[0].providerName,
          }
        : null;

      // Cross-bench index: every benchmark version this slug appears on (sequential
      // query — one server fn per loader keeps SSR single-promise).
      const idxRows = await db
        .select({
          benchmarkVersionId: benchmarkVersions.id,
          benchmarkName: benchmarks.name,
          version: benchmarkVersions.version,
          nTasks: benchmarkVersions.nTasks,
          solveRate: benchmarkRuns.solveRate,
          costPerTask: benchmarkRuns.costPerTaskReported,
          effort: effortPresets.slug,
        })
        .from(benchmarkRuns)
        .innerJoin(benchmarkVersions, eq(benchmarkRuns.benchmarkVersionId, benchmarkVersions.id))
        .innerJoin(benchmarks, eq(benchmarkVersions.benchmarkId, benchmarks.id))
        .innerJoin(models, eq(benchmarkRuns.modelId, models.id))
        .innerJoin(effortPresets, eq(benchmarkRuns.effortPresetId, effortPresets.id))
        .where(eq(models.slug, data.slug));

      const byBench = new Map<string, ModelBenchEntry>();
      for (const r of idxRows) {
        let entry = byBench.get(r.benchmarkVersionId);
        if (!entry) {
          entry = {
            benchmarkVersionId: r.benchmarkVersionId,
            benchmarkName: r.benchmarkName,
            version: r.version,
            nTasks: r.nTasks,
            runs: 0,
            bestSolve: 0,
            cheapestPerTask: null,
            effortPresets: [],
          };
          byBench.set(r.benchmarkVersionId, entry);
        }
        entry.runs += 1;
        entry.bestSolve = Math.max(entry.bestSolve, r.solveRate);
        if (r.costPerTask !== null && r.costPerTask > 0) {
          entry.cheapestPerTask =
            entry.cheapestPerTask === null
              ? r.costPerTask
              : Math.min(entry.cheapestPerTask, r.costPerTask);
        }
        if (!entry.effortPresets.includes(r.effort)) entry.effortPresets.push(r.effort);
      }
      const index = Array.from(byBench.values()).sort((a, b) => b.runs - a.runs);

      return {
        benchmarkOptions,
        currentBenchmark: activeBenchmark,
        model,
        runs: modelRuns,
        benchFrontier: frontier
          .filter((f) => f.cost !== null && f.cost > 0)
          .map((f) => ({ cost: f.cost as number, solveRate: f.solveRate }))
          .sort((a, b) => a.cost - b.cost),
        benchRunCount: decorated.length,
        index,
        error: modelRuns.length === 0 ? `No runs found for model "${data.slug}" on this benchmark.` : null,
      };
    } catch (err: any) {
      return {
        benchmarkOptions: [],
        currentBenchmark: null,
        model: null,
        runs: [],
        benchFrontier: [],
        benchRunCount: 0,
        index: [],
        error: err?.message || "Failed to load catalog data from D1.",
      };
    }
  });

// ---------------------------------------------------------------------------
// Compare matrix — 2–8 configurations on ONE benchmark version.
// Read-only D1; frontier/knee decoration is computed bench-wide so matrix rows
// carry the same badges as the Explorer. Same-benchmark guarantee is structural:
// the query is per benchmark version, so foreign ids simply don't resolve and
// come back listed as unknown.
// ---------------------------------------------------------------------------

export interface CompareResponse {
  benchmarkOptions: BenchmarkOption[];
  currentBenchmark: BenchmarkOption | null;
  selected: ExplorerRun[];
  unknownIds: string[];
  unknownSlugs: string[];
  truncated: boolean;
  benchRunCount: number;
  error: string | null;
}

export const getCompareData = createServerFn()
  .validator((input: {
    benchmarkVersionId?: string;
    ids?: string[];
    slugs?: string[];
    costBasis?: "reported" | "today";
    effortMatch?: "all" | "max" | "xhigh";
  }) => input)
  .handler(async ({ data }): Promise<CompareResponse> => {
    try {
      const db = getDb();

      const rawBenchmarks = await db
        .select({
          benchmarkVersionId: benchmarkVersions.id,
          benchmarkSlug: benchmarks.slug,
          benchmarkName: benchmarks.name,
          version: benchmarkVersions.version,
          nTasks: benchmarkVersions.nTasks,
        })
        .from(benchmarkVersions)
        .innerJoin(benchmarks, eq(benchmarkVersions.benchmarkId, benchmarks.id));

      const benchmarkOptions: BenchmarkOption[] = rawBenchmarks.map((b) => ({
        id: b.benchmarkVersionId,
        benchmarkSlug: b.benchmarkSlug,
        benchmarkName: b.benchmarkName,
        version: b.version,
        nTasks: b.nTasks,
        displayLabel: `${b.benchmarkName} ${b.version} (${b.nTasks} tasks)`,
      }));

      const activeBenchmark =
        benchmarkOptions.find(
          (b) => b.id === data.benchmarkVersionId || b.benchmarkSlug === data.benchmarkVersionId
        ) ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "terminal-bench" && b.version === "4.0") ||
        benchmarkOptions[0] ||
        null;

      if (!activeBenchmark) {
        return { benchmarkOptions: [], currentBenchmark: null, selected: [], unknownIds: [], unknownSlugs: [], truncated: false, benchRunCount: 0, error: "No benchmarks found in database." };
      }

      const rows = await db
        .select({
          run: benchmarkRuns,
          model: models,
          provider: providers,
          harness: harnesses,
          harnessVer: harnessVersions,
          effort: effortPresets,
          source: sources,
        })
        .from(benchmarkRuns)
        .innerJoin(models, eq(benchmarkRuns.modelId, models.id))
        .innerJoin(providers, eq(models.providerId, providers.id))
        .innerJoin(harnessVersions, eq(benchmarkRuns.harnessVersionId, harnessVersions.id))
        .innerJoin(harnesses, eq(harnessVersions.harnessId, harnesses.id))
        .innerJoin(effortPresets, eq(benchmarkRuns.effortPresetId, effortPresets.id))
        .innerJoin(sources, eq(benchmarkRuns.sourceId, sources.id))
        .where(eq(benchmarkRuns.benchmarkVersionId, activeBenchmark.id));

      const mapped: ExplorerRun[] = rows.map((r) => ({
        id: r.run.id,
        sourceRunId: r.run.sourceRunId,
        modelId: r.model.id,
        modelSlug: r.model.slug,
        modelDisplayName: r.model.displayName,
        providerName: r.provider.name,
        harnessId: r.harness.id,
        harnessName: r.harness.name,
        harnessVersionId: r.harnessVer.id,
        harnessVersion: r.harnessVer.version,
        effortPresetId: r.effort.id,
        effortPresetSlug: r.effort.slug,
        sourceId: r.source.id,
        sourceName: r.source.name,
        sourceOfficial: Boolean(r.source.official),
        nSolved: r.run.nSolved,
        nTotal: r.run.nTotal,
        solveRate: r.run.solveRate,
        costUsdReported: r.run.costUsdReported,
        costUsdNormalized: r.run.costUsdNormalized,
        costPerTaskReported: r.run.costPerTaskReported,
        costPerTaskNormalized: r.run.costPerTaskNormalized,
        cost: r.run.costPerTaskReported,
        hasTokens: Boolean(r.run.hasTokens),
        hasCost: Boolean(r.run.hasCost),
        hasLatency: Boolean(r.run.hasLatency),
        hasPassAtK: Boolean(r.run.hasPassAtK),
        hasCi: Boolean(r.run.hasCi),
        passAtK: r.run.passAtK,
        latencyP50Seconds: r.run.latencyP50Seconds,
        tokensIn: r.run.tokensIn,
        tokensOut: r.run.tokensOut,
      }));

      const { frontier } = dominate(mapped, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });
      const kneePoint = knee(frontier, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });
      const frontierIds = new Set(frontier.map((f) => f.id));

      const decorated = mapped.map((run) => ({
        ...run,
        isFrontier: frontierIds.has(run.id),
        isKnee: kneePoint ? run.id === kneePoint.id : false,
      }));

      const selection = selectCompareRuns(decorated, data.ids ?? [], data.slugs ?? []);

      return {
        benchmarkOptions,
        currentBenchmark: activeBenchmark,
        selected: selection.selected,
        unknownIds: selection.unknownIds,
        unknownSlugs: selection.unknownSlugs,
        truncated: selection.truncated,
        benchRunCount: decorated.length,
        error: null,
      };
    } catch (err: any) {
      return {
        benchmarkOptions: [],
        currentBenchmark: null,
        selected: [],
        unknownIds: [],
        unknownSlugs: [],
        truncated: false,
        benchRunCount: 0,
        error: err?.message || "Failed to load catalog data from D1.",
      };
    }
  });

// ---------------------------------------------------------------------------
// Run dossier — one configuration run, fully attributed.
// Read-only D1. The response is benchmark-scoped by construction (the run id
// pins the benchmark version), so deep links are same-benchmark inherently.
// Reported cost is the primary number; restated (normalized) cost is surfaced
// only when non-null and never substituted for reported.
// ---------------------------------------------------------------------------

export interface RunDossierResponse {
  run: ExplorerRun | null;
  benchmark: BenchmarkOption | null;
  benchRunCount: number;
  error: string | null;
}

export const getRunDossier = createServerFn()
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<RunDossierResponse> => {
    try {
      const db = getDb();

      const rows = await db
        .select({
          run: benchmarkRuns,
          model: models,
          provider: providers,
          harness: harnesses,
          harnessVer: harnessVersions,
          effort: effortPresets,
          source: sources,
        })
        .from(benchmarkRuns)
        .innerJoin(models, eq(benchmarkRuns.modelId, models.id))
        .innerJoin(providers, eq(models.providerId, providers.id))
        .innerJoin(harnessVersions, eq(benchmarkRuns.harnessVersionId, harnessVersions.id))
        .innerJoin(harnesses, eq(harnessVersions.harnessId, harnesses.id))
        .innerJoin(effortPresets, eq(benchmarkRuns.effortPresetId, effortPresets.id))
        .innerJoin(sources, eq(benchmarkRuns.sourceId, sources.id))
        .where(eq(benchmarkRuns.id, data.id))
        .limit(1);

      if (rows.length === 0) {
        return { run: null, benchmark: null, benchRunCount: 0, error: null };
      }

      const r = rows[0];
      const benchVersionId = r.run.benchmarkVersionId;

      const benchRows = await db
        .select({
          benchmarkVersionId: benchmarkVersions.id,
          benchmarkSlug: benchmarks.slug,
          benchmarkName: benchmarks.name,
          version: benchmarkVersions.version,
          nTasks: benchmarkVersions.nTasks,
        })
        .from(benchmarkVersions)
        .innerJoin(benchmarks, eq(benchmarkVersions.benchmarkId, benchmarks.id));

      const benchOptions: BenchmarkOption[] = benchRows.map((b) => ({
        id: b.benchmarkVersionId,
        benchmarkSlug: b.benchmarkSlug,
        benchmarkName: b.benchmarkName,
        version: b.version,
        nTasks: b.nTasks,
        displayLabel: `${b.benchmarkName} ${b.version} (${b.nTasks} tasks)`,
      }));

      const benchRuns = await db
        .select({ n: benchmarkRuns.id })
        .from(benchmarkRuns)
        .where(eq(benchmarkRuns.benchmarkVersionId, benchVersionId));

      const run: ExplorerRun = {
        id: r.run.id,
        sourceRunId: r.run.sourceRunId,
        modelId: r.model.id,
        modelSlug: r.model.slug,
        modelDisplayName: r.model.displayName,
        providerName: r.provider.name,
        harnessId: r.harness.id,
        harnessName: r.harness.name,
        harnessVersionId: r.harnessVer.id,
        harnessVersion: r.harnessVer.version,
        effortPresetId: r.effort.id,
        effortPresetSlug: r.effort.slug,
        sourceId: r.source.id,
        sourceName: r.source.name,
        sourceOfficial: Boolean(r.source.official),
        nSolved: r.run.nSolved,
        nTotal: r.run.nTotal,
        solveRate: r.run.solveRate,
        costUsdReported: r.run.costUsdReported,
        costUsdNormalized: r.run.costUsdNormalized,
        costPerTaskReported: r.run.costPerTaskReported,
        costPerTaskNormalized: r.run.costPerTaskNormalized,
        cost: r.run.costPerTaskReported,
        hasTokens: Boolean(r.run.hasTokens),
        hasCost: Boolean(r.run.hasCost),
        hasLatency: Boolean(r.run.hasLatency),
        hasPassAtK: Boolean(r.run.hasPassAtK),
        hasCi: Boolean(r.run.hasCi),
        passAtK: r.run.passAtK,
        latencyP50Seconds: r.run.latencyP50Seconds,
        tokensIn: r.run.tokensIn,
        tokensOut: r.run.tokensOut,
      };

      return {
        run,
        benchmark: benchOptions.find((b) => b.id === benchVersionId) ?? null,
        benchRunCount: benchRuns.length,
        error: null,
      };
    } catch (err: any) {
      return { run: null, benchmark: null, benchRunCount: 0, error: err?.message || "Failed to load run from D1." };
    }
  });

export interface IngestHealthResponse {
  status: "ok" | "degraded" | "error";
  lastJob: {
    id: string | null;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  };
  runCounts: Record<string, number>;
  restatedCostCount: number;
  reportedCostCount: number;
  totalRuns: number;
  unmatched: {
    no_alias: number;
    no_snapshot: number;
    no_tokens: number;
  };
  error?: string | null;
}

export const getIngestHealth = createServerFn().handler(
  async (): Promise<IngestHealthResponse> => {
    try {
      const db = getDb();
      const lastJobRes = await (db as any).session.client
        .prepare(
          `SELECT id, status, started_at, completed_at, error, summary
           FROM ingest_jobs
           ORDER BY started_at DESC
           LIMIT 1`
        )
        .first();

      let jobError = lastJobRes?.error || null;
      if (!jobError && lastJobRes?.summary) {
        try {
          const parsed = JSON.parse(lastJobRes.summary);
          if (parsed.error) jobError = parsed.error;
        } catch {}
      }

      const countsRes = await (db as any).session.client
        .prepare(
          `SELECT b.slug as benchmark_slug, count(r.id) as count
           FROM benchmark_runs r
           JOIN benchmark_versions bv ON r.benchmark_version_id = bv.id
           JOIN benchmarks b ON bv.benchmark_id = b.id
           GROUP BY b.slug`
        )
        .all();

      const runCounts: Record<string, number> = {};
      for (const row of (countsRes.results || []) as Array<{ benchmark_slug: string; count: number }>) {
        runCounts[row.benchmark_slug] = row.count;
      }

      const costCountsRes = await (db as any).session.client
        .prepare(
          `SELECT
             sum(case when cost_usd_normalized is not null then 1 else 0 end) as normalized_count,
             sum(case when cost_usd_reported is not null then 1 else 0 end) as reported_count,
             count(*) as total_count
           FROM benchmark_runs`
        )
        .first();

      const unmatchedRes = await (db as any).session.client
        .prepare(
          `SELECT
             sum(case when r.tokens_in is null or r.tokens_in <= 0 then 1 else 0 end) as no_tokens,
             sum(case when (r.tokens_in is not null and r.tokens_in > 0) and ma.model_id is null then 1 else 0 end) as no_alias,
             sum(case when (r.tokens_in is not null and r.tokens_in > 0) and ma.model_id is not null and ps.model_id is null then 1 else 0 end) as no_snapshot
           FROM benchmark_runs r
           LEFT JOIN (SELECT DISTINCT model_id FROM model_aliases WHERE alias LIKE '%/%') ma ON r.model_id = ma.model_id
           LEFT JOIN (SELECT DISTINCT model_id FROM pricing_snapshots) ps ON r.model_id = ps.model_id
           WHERE r.cost_usd_normalized is null`
        )
        .first();

      const unmatched = {
        no_alias: Number(unmatchedRes?.no_alias ?? 0),
        no_snapshot: Number(unmatchedRes?.no_snapshot ?? 0),
        no_tokens: Number(unmatchedRes?.no_tokens ?? 0),
      };

      return {
        status: lastJobRes?.status === "failed" ? "degraded" : "ok",
        lastJob: {
          id: lastJobRes?.id || null,
          status: lastJobRes?.status || "unknown",
          startedAt: lastJobRes?.started_at || null,
          completedAt: lastJobRes?.completed_at || null,
          error: jobError,
        },
        runCounts,
        restatedCostCount: costCountsRes?.normalized_count ?? 0,
        reportedCostCount: costCountsRes?.reported_count ?? 0,
        totalRuns: costCountsRes?.total_count ?? 0,
        unmatched,
        error: null,
      };
    } catch (err: any) {
      return {
        status: "error",
        lastJob: {
          id: null,
          status: "unknown",
          startedAt: null,
          completedAt: null,
          error: err?.message || String(err),
        },
        runCounts: {},
        restatedCostCount: 0,
        reportedCostCount: 0,
        totalRuns: 0,
        unmatched: {
          no_alias: 0,
          no_snapshot: 0,
          no_tokens: 0,
        },
        error: err?.message || String(err),
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Model cross-bench index — every benchmark version a slug appears on.
// Read-only D1. Each entry links to that bench's board; benches are never mixed
// into one scatter.
// ---------------------------------------------------------------------------

export interface ModelBenchEntry {
  benchmarkVersionId: string;
  benchmarkName: string;
  version: string;
  nTasks: number;
  runs: number;
  bestSolve: number;
  cheapestPerTask: number | null;
  effortPresets: string[];
}



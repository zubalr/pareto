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
  .validator((input: { benchmarkVersionId?: string }) => input)
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

      const candidates = rows.map((r) => ({
        id: r.run.id,
        sourceRunId: r.run.sourceRunId,
        modelDisplayName: r.model.displayName,
        modelSlug: r.model.slug,
        harnessName: r.harness.name,
        harnessVersion: r.harnessVer.version,
        effortPresetSlug: r.effort.slug,
        solveRate: r.run.solveRate,
        cost: r.run.costPerTaskReported,
        costUsdTotal: r.run.costUsdReported,
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

export interface ModelPageResponse {
  benchmarkOptions: BenchmarkOption[];
  currentBenchmark: BenchmarkOption | null;
  model: { id: string; slug: string; displayName: string; providerName: string } | null;
  runs: ExplorerRun[];
  benchFrontier: Array<{ cost: number; solveRate: number }>;
  benchRunCount: number;
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
        benchmarkOptions.find((b) => b.benchmarkSlug === "terminal-bench" && b.version === "4.0") ||
        benchmarkOptions[0] ||
        null;

      if (!activeBenchmark) {
        return { benchmarkOptions: [], currentBenchmark: null, model: null, runs: [], benchFrontier: [], benchRunCount: 0, error: "No benchmarks found in database." };
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
  .validator((input: { benchmarkVersionId?: string; ids?: string[]; slugs?: string[] }) => input)
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

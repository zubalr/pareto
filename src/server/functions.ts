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

export interface ExplorerRun extends Point {
  id: string;
  sourceRunId: string;
  modelId: string;
  modelSlug: string;
  modelDisplayName: string;
  providerName: string;
  harnessId: string;
  harnessName: string;
  harnessVersionId: string;
  harnessVersion: string;
  effortPresetId: string;
  effortPresetSlug: string;
  sourceId: string;
  sourceName: string;
  sourceOfficial: boolean;
  nSolved: number;
  nTotal: number;
  solveRate: number;
  costUsdReported: number | null;
  costUsdNormalized: number | null;
  costPerTaskReported: number | null;
  costPerTaskNormalized: number | null;
  hasTokens: boolean;
  hasCost: boolean;
  hasLatency: boolean;
  hasPassAtK: boolean;
  hasCi: boolean;
  passAtK: string;
  latencyP50Seconds: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  isFrontier?: boolean;
  isKnee?: boolean;
}

export interface FilterOption {
  id: string;
  name: string;
  slug: string;
}

export interface BenchmarkOption {
  id: string; // benchmarkVersionId
  benchmarkSlug: string;
  benchmarkName: string;
  version: string;
  nTasks: number;
  displayLabel: string;
}

export interface ExplorerResponse {
  benchmarkOptions: BenchmarkOption[];
  currentBenchmark: BenchmarkOption | null;
  availableModels: FilterOption[];
  availableHarnesses: FilterOption[];
  availableEfforts: FilterOption[];
  allRuns: ExplorerRun[];
  frontier: ExplorerRun[];
  kneePoint: ExplorerRun | null;
  costBasis: "reported" | "today";
  error: string | null;
  isCachedFrontier?: boolean;
}

export const getExplorerData = createServerFn()
  .validator((input: {
    benchmarkVersionId?: string;
    models?: string[];
    harnesses?: string[];
    efforts?: string[];
    costBasis?: "reported" | "today";
  }) => input)
  .handler(async ({ data }): Promise<ExplorerResponse> => {
    const costBasis = data.costBasis ?? "reported";
    const selectedModelSlugs = data.models?.filter(Boolean) ?? [];
    const selectedHarnessSlugs = data.harnesses?.filter(Boolean) ?? [];
    const selectedEffortSlugs = data.efforts?.filter(Boolean) ?? [];

    try {
      const db = getDb();

      // 1. Fetch benchmarks with versions
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

      // Select requested benchmark or default to Terminal-Bench 4.0
      let activeBenchmark =
        benchmarkOptions.find((b) => b.id === data.benchmarkVersionId || b.benchmarkSlug === data.benchmarkVersionId) ||
        benchmarkOptions.find((b) => b.benchmarkSlug === "terminal-bench" && b.version === "4.0") ||
        benchmarkOptions[0] ||
        null;

      if (!activeBenchmark) {
        return {
          benchmarkOptions: [],
          currentBenchmark: null,
          availableModels: [],
          availableHarnesses: [],
          availableEfforts: [],
          allRuns: [],
          frontier: [],
          kneePoint: null,
          costBasis,
          error: "No benchmarks found in database.",
        };
      }

      // 2. Fetch all runs for this benchmark version to determine available filter options
      const allBenchmarkRuns = await db
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

      // Extract unique filter options present in this benchmark version
      const modelMap = new Map<string, FilterOption>();
      const harnessMap = new Map<string, FilterOption>();
      const effortMap = new Map<string, FilterOption>();

      for (const row of allBenchmarkRuns) {
        if (!modelMap.has(row.model.slug)) {
          modelMap.set(row.model.slug, {
            id: row.model.id,
            name: row.model.displayName,
            slug: row.model.slug,
          });
        }
        if (!harnessMap.has(row.harness.slug)) {
          harnessMap.set(row.harness.slug, {
            id: row.harness.id,
            name: row.harness.name,
            slug: row.harness.slug,
          });
        }
        if (!effortMap.has(row.effort.slug)) {
          effortMap.set(row.effort.slug, {
            id: row.effort.id,
            name: row.effort.name,
            slug: row.effort.slug,
          });
        }
      }

      const availableModels = Array.from(modelMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      const availableHarnesses = Array.from(harnessMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      const availableEfforts = Array.from(effortMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      // 3. Filter runs based on search params (empty multi-select means all configs that have data)
      const filteredRows = allBenchmarkRuns.filter((row) => {
        if (selectedModelSlugs.length > 0 && !selectedModelSlugs.includes(row.model.slug)) {
          return false;
        }
        if (selectedHarnessSlugs.length > 0 && !selectedHarnessSlugs.includes(row.harness.slug)) {
          return false;
        }
        if (selectedEffortSlugs.length > 0 && !selectedEffortSlugs.includes(row.effort.slug)) {
          return false;
        }
        return true;
      });

      // 4. Map to ExplorerRun
      const mappedRuns: ExplorerRun[] = filteredRows.map((r) => {
        const costPerTask =
          costBasis === "today"
            ? (r.run.costPerTaskNormalized ?? r.run.costPerTaskReported)
            : r.run.costPerTaskReported;

        return {
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
          cost: costPerTask, // USD/task for metrics calculation
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
      });

      // 5. Compute Pareto frontier & knee
      const isDefaultTB =
        activeBenchmark.benchmarkSlug === "terminal-bench" &&
        activeBenchmark.version === "4.0" &&
        selectedModelSlugs.length === 0 &&
        selectedHarnessSlugs.length === 0 &&
        selectedEffortSlugs.length === 0 &&
        costBasis === "reported";

      const kv = getKv();
      let cachedFrontierIds: string[] | null = null;

      if (isDefaultTB && kv) {
        try {
          const cached = await kv.get("frontier:terminal-bench-4.0", "json") as {
            frontierIds: string[];
            kneeId: string;
          } | null;
          if (cached && Array.isArray(cached.frontierIds)) {
            cachedFrontierIds = cached.frontierIds;
          }
        } catch (e) {
          console.warn("KV read error:", e);
        }
      }

      // Compute frontier using pure metrics module
      const { frontier: rawFrontier } = dominate(mappedRuns, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });

      const kneePoint = knee(rawFrontier, {
        getCost: (p) => p.cost,
        getSolveRate: (p) => p.solveRate,
      });

      const frontierIdSet = new Set(rawFrontier.map((f) => f.id));

      // Put to KV for default TB slice if kv exists
      if (isDefaultTB && kv) {
        try {
          await kv.put(
            "frontier:terminal-bench-4.0",
            JSON.stringify({
              frontierIds: Array.from(frontierIdSet),
              kneeId: kneePoint?.id ?? null,
              timestamp: new Date().toISOString(),
            })
          );
        } catch (e) {
          console.warn("KV put error:", e);
        }
      }

      // Mark runs with isFrontier and isKnee
      const decoratedRuns = mappedRuns.map((run) => ({
        ...run,
        isFrontier: frontierIdSet.has(run.id),
        isKnee: kneePoint ? run.id === kneePoint.id : false,
      }));

      const finalFrontier = decoratedRuns.filter((r) => r.isFrontier);

      return {
        benchmarkOptions,
        currentBenchmark: activeBenchmark,
        availableModels,
        availableHarnesses,
        availableEfforts,
        allRuns: decoratedRuns,
        frontier: finalFrontier,
        kneePoint: decoratedRuns.find((r) => r.isKnee) ?? null,
        costBasis,
        error: null,
        isCachedFrontier: Boolean(cachedFrontierIds),
      };
    } catch (err: any) {
      console.error("Error in getExplorerData:", err);
      return {
        benchmarkOptions: [],
        currentBenchmark: null,
        availableModels: [],
        availableHarnesses: [],
        availableEfforts: [],
        allRuns: [],
        frontier: [],
        kneePoint: null,
        costBasis,
        error: err?.message || "Failed to load catalog data from D1.",
      };
    }
  });

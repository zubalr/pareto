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

export interface ExplorerInput {
  benchmarkVersionId?: string;
  models?: string[];
  harnesses?: string[];
  efforts?: string[];
  costBasis?: "reported" | "today";
}

import { buildCanonicalExplorerKey } from "./keys";
export { buildCanonicalExplorerKey };

export async function fetchExplorerData(data: ExplorerInput): Promise<ExplorerResponse> {
  const costBasis = data.costBasis ?? "reported";
  const selectedModelSlugs = data.models?.filter(Boolean) ?? [];
  const selectedHarnessSlugs = data.harnesses?.filter(Boolean) ?? [];
  const selectedEffortSlugs = data.efforts?.filter(Boolean) ?? [];

  const kv = getKv();
  const cacheKey = buildCanonicalExplorerKey(data);

  // 1. Hot Path: Check KV cache first. On hit, return immediately with 0 D1 reads.
  if (kv) {
    try {
      const cached = (await kv.get(cacheKey, "json")) as ExplorerResponse | null;
      if (cached && Array.isArray(cached.allRuns) && Array.isArray(cached.frontier)) {
        console.log(`[KV HIT] Key: ${cacheKey}`);
        return {
          ...cached,
          isCachedFrontier: true,
        };
      }
    } catch (err) {
      console.warn(`[KV READ ERROR] Key: ${cacheKey}`, err);
    }
  }

  console.log(`[KV MISS] Key: ${cacheKey}. Executing indexed D1 query...`);

  try {
    const db = getDb();

    // 2. Fetch benchmarks with versions (check KV catalog cache first)
    let benchmarkOptions: BenchmarkOption[] | null = null;
    if (kv) {
      try {
        benchmarkOptions = (await kv.get("catalog:benchmark_options", "json")) as BenchmarkOption[] | null;
      } catch (e) {
        console.warn("KV catalog:benchmark_options read error:", e);
      }
    }

    if (!benchmarkOptions || benchmarkOptions.length === 0) {
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

      benchmarkOptions = rawBenchmarks.map((b) => ({
        id: b.benchmarkVersionId,
        benchmarkSlug: b.benchmarkSlug,
        benchmarkName: b.benchmarkName,
        version: b.version,
        nTasks: b.nTasks,
        displayLabel: `${b.benchmarkName} ${b.version} (${b.nTasks} tasks)`,
      }));

      if (kv && benchmarkOptions.length > 0) {
        try {
          await kv.put("catalog:benchmark_options", JSON.stringify(benchmarkOptions), {
            expirationTtl: 86400, // 24 hours
          });
        } catch (e) {
          console.warn("KV catalog:benchmark_options put error:", e);
        }
      }
    }

    // Select requested benchmark or default to Terminal-Bench 4.0
    const activeBenchmark =
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
        isCachedFrontier: false,
      };
    }

    // 3. Single indexed D1 query for this benchmark version's runs
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

    // 4. Filter runs based on search params
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

    // 5. Map to ExplorerRun
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

    // 6. Compute Pareto frontier & knee in-process
    const { frontier: rawFrontier } = dominate(mappedRuns, {
      getCost: (p) => p.cost,
      getSolveRate: (p) => p.solveRate,
    });

    const kneePoint = knee(rawFrontier, {
      getCost: (p) => p.cost,
      getSolveRate: (p) => p.solveRate,
    });

    const frontierIdSet = new Set(rawFrontier.map((f) => f.id));

    // Mark runs with isFrontier and isKnee
    const decoratedRuns = mappedRuns.map((run) => ({
      ...run,
      isFrontier: frontierIdSet.has(run.id),
      isKnee: kneePoint ? run.id === kneePoint.id : false,
    }));

    const finalFrontier = decoratedRuns.filter((r) => r.isFrontier);

    const responsePayload: ExplorerResponse = {
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
      isCachedFrontier: false,
    };

    // 7. Store in KV with expirationTtl >= 6 hours (86,400 seconds = 24 hours)
    if (kv) {
      try {
        await kv.put(cacheKey, JSON.stringify(responsePayload), {
          expirationTtl: 86400, // 24 hours (>= 6 hours)
        });
        console.log(`[KV PUT] Cached response under key: ${cacheKey}`);

        // Also preserve backwards compatibility for frontier:terminal-bench-4.0 if default TB
        if (
          activeBenchmark.benchmarkSlug === "terminal-bench" &&
          activeBenchmark.version === "4.0" &&
          selectedModelSlugs.length === 0 &&
          selectedHarnessSlugs.length === 0 &&
          selectedEffortSlugs.length === 0 &&
          costBasis === "reported"
        ) {
          await kv.put(
            "frontier:terminal-bench-4.0",
            JSON.stringify({
              frontierIds: Array.from(frontierIdSet),
              kneeId: kneePoint?.id ?? null,
              timestamp: new Date().toISOString(),
            }),
            { expirationTtl: 86400 }
          );
        }
      } catch (e) {
        console.warn(`[KV PUT ERROR] Key: ${cacheKey}`, e);
      }
    }

    return responsePayload;
  } catch (err: any) {
    console.error("Error in fetchExplorerData:", err);
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
      isCachedFrontier: false,
    };
  }
}

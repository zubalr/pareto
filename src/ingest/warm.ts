import { fetchExplorerData, fetchBenchmarkOptions, buildCanonicalExplorerKey } from "../server/explorer-service";

export const WARM_BENCHMARK_VERSION_IDS = [
  "01J8BV000000000000DEEPSWE11",
  "01J8BV000000000000000SWE10",
  "01J8BVAIDER00000000000POLY",
  "01J8BV000000000000000TB20",
  "01J8BV0000000000000000TB40",
];

const COST_BASES: Array<"reported" | "today"> = ["reported", "today"];

export async function warmExplorerCache(kv?: any, d1?: any): Promise<string[]> {
  const warmedKeys: string[] = [];

  // Invalidate cached catalog and default frontier keys if kv is provided
  if (kv) {
    try {
      await kv.delete("catalog:benchmark_options");
    } catch (err) {
      console.warn("[WarmCache] Error invalidating catalog:benchmark_options:", err);
    }
  }

  // Put fresh benchmark options into KV so new benchmark versions appear immediately
  try {
    console.log("[WarmCache] Writing fresh KV cache for: catalog:benchmark_options");
    await fetchBenchmarkOptions(kv, true, d1);
    warmedKeys.push("catalog:benchmark_options");
  } catch (err) {
    console.warn("[WarmCache] Error writing catalog:benchmark_options:", err);
  }

  if (kv) {
    try {
      for (const bvId of WARM_BENCHMARK_VERSION_IDS) {
        for (const cb of COST_BASES) {
          const key = buildCanonicalExplorerKey({
            benchmarkVersionId: bvId,
            costBasis: cb,
          });
          await kv.delete(key);
        }
      }
    } catch (err) {
      console.warn("[WarmCache] Error invalidating old cache keys:", err);
    }
  }

  // Warm each default slice for both reported and today cost bases
  for (const bvId of WARM_BENCHMARK_VERSION_IDS) {
    for (const cb of COST_BASES) {
      const key = buildCanonicalExplorerKey({
        benchmarkVersionId: bvId,
        costBasis: cb,
      });
      console.log(`[WarmCache] Refreshing KV cache for: ${key}`);
      await fetchExplorerData({
        benchmarkVersionId: bvId,
        costBasis: cb,
        forceRefresh: true,
        d1,
      });
      warmedKeys.push(key);
    }
  }

  return warmedKeys;
}

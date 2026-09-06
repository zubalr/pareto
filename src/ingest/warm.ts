import { fetchExplorerData, buildCanonicalExplorerKey } from "../server/explorer-service";

export const WARM_BENCHMARK_VERSION_IDS = [
  "01J8BV0000000000000000TB40",
  "01J8BVAIDER00000000000POLY",
];

export async function warmExplorerCache(kv?: any): Promise<string[]> {
  const warmedKeys: string[] = [];

  // Invalidate cached catalog and default frontier keys if kv is provided
  if (kv) {
    try {
      await kv.delete("catalog:benchmark_options");
      for (const bvId of WARM_BENCHMARK_VERSION_IDS) {
        const key = buildCanonicalExplorerKey({
          benchmarkVersionId: bvId,
          costBasis: "reported",
        });
        await kv.delete(key);
      }
    } catch (err) {
      console.warn("[WarmCache] Error invalidating old cache keys:", err);
    }
  }

  // Warm each default slice
  for (const bvId of WARM_BENCHMARK_VERSION_IDS) {
    const key = buildCanonicalExplorerKey({
      benchmarkVersionId: bvId,
      costBasis: "reported",
    });
    console.log(`[WarmCache] Refreshing KV cache for: ${key}`);
    await fetchExplorerData({
      benchmarkVersionId: bvId,
      costBasis: "reported",
    });
    warmedKeys.push(key);
  }

  return warmedKeys;
}

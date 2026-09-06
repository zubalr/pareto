import { ingestAiderPolyglot, AIDER_SOURCE_ID } from "./aider";
import { ingestOpenRouterPricing } from "./openrouter";
import { ingestHarbor } from "./harbor";
import { ingestSWEBench } from "./swebench";
import { ingestDeepSWE } from "./deepswe";
import { recomputeNormalizedCosts } from "./restate";
import { warmExplorerCache } from "./warm";
import type { IngestPipelineResult } from "./types";
import { env as workersEnv } from "cloudflare:workers";

function generateDeterministicId(prefix: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  const hex = (Math.abs(hash) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
  return `${prefix}${hex}${cleanSeed}`.slice(0, 26).padEnd(26, "0");
}

export interface RunPipelineOptions {
  env?: any;
  ctx?: any;
  d1?: any;
  kv?: any;
  adapters?: Array<"aider" | "openrouter" | "harbor" | "swebench" | "deepswe" | "restate">;
  retry?: boolean;
}

export async function runIngestPipeline(options?: RunPipelineOptions): Promise<IngestPipelineResult> {
  const d1 = options?.d1 ?? options?.env?.DB ?? workersEnv?.DB;
  const kv = options?.kv ?? options?.env?.FRONTIER ?? workersEnv?.FRONTIER;

  if (!d1) {
    throw new Error("Cannot run ingest pipeline: D1 database binding 'DB' is missing.");
  }

  const startedAt = new Date().toISOString();
  const jobId = generateDeterministicId("01J8JOB", `${startedAt}`);

  console.log(`[Ingest] Starting pipeline job ${jobId} at ${startedAt}...`);

  // 1. Record initial running job
  try {
    await d1
      .prepare(
        `INSERT INTO ingest_jobs (id, source_id, status, started_at, completed_at, error, summary)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)`
      )
      .bind(jobId, AIDER_SOURCE_ID, "running", startedAt, JSON.stringify({ phase: "started" }))
      .run();
  } catch (err) {
    console.warn("[Ingest] Failed to record initial ingest_jobs row:", err);
  }

  // Determine adapters to run
  let targetAdapters: string[] = options?.adapters ?? ["aider", "openrouter", "harbor", "swebench", "deepswe", "restate"];
  if (options?.retry && !options?.adapters) {
    try {
      const lastFailed = (await d1
        .prepare("SELECT error FROM ingest_jobs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 1")
        .first()) as { error?: string } | null;

      if (lastFailed?.error) {
        const errText = lastFailed.error.toLowerCase();
        const detected: string[] = [];
        if (errText.includes("aider")) detected.push("aider");
        if (errText.includes("openrouter")) detected.push("openrouter");
        if (errText.includes("harbor")) detected.push("harbor");
        if (errText.includes("swe-bench") || errText.includes("swebench")) detected.push("swebench");
        if (errText.includes("deepswe")) detected.push("deepswe");

        if (detected.length > 0) {
          detected.push("restate");
          targetAdapters = Array.from(new Set(detected));
          console.log(`[Ingest] Retry mode detected target adapters from previous failure: ${targetAdapters.join(", ")}`);
        }
      }
    } catch (e) {
      console.warn("[Ingest] Failed to inspect previous failure for retry, running full pipeline:", e);
    }
  }

  try {
    let aiderRunsCount = 0;
    let openRouterSnapshotsCount = 0;
    let harborRunsCount = 0;
    let swebenchRunsCount = 0;
    let deepsweRunsCount = 0;
    let matchedModels: string[] = [];

    // 2. Ingest Aider polyglot runs
    if (targetAdapters.includes("aider")) {
      console.log("[Ingest] Ingesting Aider polyglot leaderboard...");
      try {
        const aiderResult = await ingestAiderPolyglot({ d1 });
        aiderRunsCount = aiderResult.runsIngested;
        console.log(`[Ingest] Successfully ingested/upserted ${aiderRunsCount} Aider runs.`);
      } catch (err: any) {
        throw new Error(`[Aider Ingest Failed] ${err?.message || err}`);
      }
    }

    // 3. Ingest OpenRouter pricing snapshots
    if (targetAdapters.includes("openrouter")) {
      console.log("[Ingest] Ingesting OpenRouter model pricing snapshots...");
      try {
        const orResult = await ingestOpenRouterPricing({ d1 });
        openRouterSnapshotsCount = orResult.snapshotsIngested;
        matchedModels = orResult.matchedModels;
        console.log(
          `[Ingest] Successfully snapshotted ${openRouterSnapshotsCount} models (${matchedModels.join(", ")}).`
        );
      } catch (err: any) {
        throw new Error(`[OpenRouter Ingest Failed] ${err?.message || err}`);
      }
    }

    // 4. Ingest Harbor / Terminal-Bench runs
    if (targetAdapters.includes("harbor")) {
      console.log("[Ingest] Ingesting Harbor / Terminal-Bench leaderboard...");
      try {
        const harborResult = await ingestHarbor({ d1 });
        harborRunsCount = harborResult.ingestedCount;
        console.log(`[Ingest] Successfully ingested/upserted ${harborRunsCount} Harbor runs.`);
      } catch (err: any) {
        throw new Error(`[Harbor Ingest Failed] ${err?.message || err}`);
      }
    }

    // 5. Ingest SWE-bench Verified runs
    if (targetAdapters.includes("swebench")) {
      console.log("[Ingest] Ingesting SWE-bench Verified leaderboard...");
      try {
        const sweResult = await ingestSWEBench({ d1 });
        swebenchRunsCount = sweResult.ingestedCount;
        console.log(`[Ingest] Successfully ingested/upserted ${swebenchRunsCount} SWE-bench runs.`);
      } catch (err: any) {
        throw new Error(`[SWE-bench Ingest Failed] ${err?.message || err}`);
      }
    }

    // 6. Ingest DeepSWE v1.1 runs
    if (targetAdapters.includes("deepswe")) {
      console.log("[Ingest] Ingesting DeepSWE v1.1 leaderboard...");
      try {
        const deepsweResult = await ingestDeepSWE({ d1 });
        deepsweRunsCount = deepsweResult.ingestedCount;
        console.log(`[Ingest] Successfully ingested/upserted ${deepsweRunsCount} DeepSWE runs.`);
      } catch (err: any) {
        throw new Error(`[DeepSWE Ingest Failed] ${err?.message || err}`);
      }
    }

    // 7. Recompute normalized costs from OpenRouter snapshots
    let restatedRunsCount = 0;
    if (targetAdapters.includes("restate") || targetAdapters.includes("openrouter")) {
      console.log("[Ingest] Recomputing normalized costs on Today basis...");
      try {
        const restateResult = await recomputeNormalizedCosts({ d1 });
        restatedRunsCount = restateResult.runsRestated;
        console.log(
          `[Ingest] Successfully restated normalized costs for ${restateResult.runsRestated} runs (${restateResult.runsResetToNull} reset to NULL, ${restateResult.unchangedCount} unchanged).`
        );
      } catch (err: any) {
        throw new Error(`[Cost Restatement Failed] ${err?.message || err}`);
      }
    }

    // 8. Invalidate & warm KV caches
    console.log("[Ingest] Warming default Explorer KV cache slices...");
    const warmedKeys = await warmExplorerCache(kv);
    console.log(`[Ingest] Successfully warmed KV keys: ${warmedKeys.join(", ")}`);

    const completedAt = new Date().toISOString();
    const summary = {
      aiderRunsIngested: aiderRunsCount,
      openRouterSnapshotsIngested: openRouterSnapshotsCount,
      harborRunsIngested: harborRunsCount,
      swebenchRunsIngested: swebenchRunsCount,
      deepsweRunsIngested: deepsweRunsCount,
      restatedRunsCount,
      matchedModels,
      warmedCacheKeys: warmedKeys,
    };

    // 9. Mark job as completed
    await d1
      .prepare(
        `UPDATE ingest_jobs
         SET status = 'completed', completed_at = ?, error = NULL, summary = ?
         WHERE id = ?`
      )
      .bind(completedAt, JSON.stringify(summary), jobId)
      .run();

    console.log(`[Ingest] Job ${jobId} finished successfully in ${Date.now() - new Date(startedAt).getTime()}ms.`);

    return {
      jobId,
      status: "completed",
      startedAt,
      completedAt,
      aiderRunsCount,
      openRouterSnapshotsCount,
      harborRunsCount,
      swebenchRunsCount,
      deepsweRunsCount,
      restatedRunsCount,
      warmedCacheKeys: warmedKeys,
    };
  } catch (err: any) {
    const failedAt = new Date().toISOString();
    const errorMessage = err?.message || String(err);
    console.error(`[Ingest] Job ${jobId} failed:`, err);

    try {
      await d1
        .prepare(
          `UPDATE ingest_jobs
           SET status = 'failed', completed_at = ?, error = ?, summary = ?
           WHERE id = ?`
        )
        .bind(failedAt, errorMessage, JSON.stringify({ error: errorMessage }), jobId)
        .run();
    } catch (dbErr) {
      console.error("[Ingest] Failed to update ingest_jobs status on failure:", dbErr);
    }

    throw err;
  }
}

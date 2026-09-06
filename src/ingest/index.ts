import { ingestAiderPolyglot, AIDER_SOURCE_ID } from "./aider";
import { ingestOpenRouterPricing } from "./openrouter";
import { ingestHarbor } from "./harbor";
import { ingestSWEBench } from "./swebench";
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
        `INSERT INTO ingest_jobs (id, source_id, status, started_at, completed_at, summary)
         VALUES (?, ?, ?, ?, NULL, ?)`
      )
      .bind(jobId, AIDER_SOURCE_ID, "running", startedAt, JSON.stringify({ phase: "started" }))
      .run();
  } catch (err) {
    console.warn("[Ingest] Failed to record initial ingest_jobs row:", err);
  }

  try {
    // 2. Ingest Aider polyglot runs
    console.log("[Ingest] 1/5 Ingesting Aider polyglot leaderboard...");
    let aiderResult: any;
    try {
      aiderResult = await ingestAiderPolyglot({ d1 });
      console.log(`[Ingest] Successfully ingested/upserted ${aiderResult.runsIngested} Aider runs.`);
    } catch (err: any) {
      throw new Error(`[Aider Ingest Failed] ${err?.message || err}`);
    }

    // 3. Ingest OpenRouter pricing snapshots
    console.log("[Ingest] 2/5 Ingesting OpenRouter model pricing snapshots...");
    let orResult: any;
    try {
      orResult = await ingestOpenRouterPricing({ d1 });
      console.log(
        `[Ingest] Successfully snapshotted ${orResult.snapshotsIngested} models (${orResult.matchedModels.join(", ")}).`
      );
    } catch (err: any) {
      throw new Error(`[OpenRouter Ingest Failed] ${err?.message || err}`);
    }

    // 4. Ingest Harbor / Terminal-Bench runs
    console.log("[Ingest] 3/5 Ingesting Harbor / Terminal-Bench leaderboard...");
    let harborResult: any;
    try {
      harborResult = await ingestHarbor({ d1 });
      console.log(`[Ingest] Successfully ingested/upserted ${harborResult.ingestedCount} Harbor runs.`);
    } catch (err: any) {
      throw new Error(`[Harbor Ingest Failed] ${err?.message || err}`);
    }

    // 5. Ingest SWE-bench Verified runs
    console.log("[Ingest] 4/5 Ingesting SWE-bench Verified leaderboard...");
    let sweResult: any;
    try {
      sweResult = await ingestSWEBench({ d1 });
      console.log(`[Ingest] Successfully ingested/upserted ${sweResult.ingestedCount} SWE-bench runs.`);
    } catch (err: any) {
      throw new Error(`[SWE-bench Ingest Failed] ${err?.message || err}`);
    }

    // 6. Invalidate & warm KV caches
    console.log("[Ingest] 5/5 Warming default Explorer KV cache slices...");
    const warmedKeys = await warmExplorerCache(kv);
    console.log(`[Ingest] Successfully warmed KV keys: ${warmedKeys.join(", ")}`);

    const completedAt = new Date().toISOString();
    const summary = {
      aiderRunsIngested: aiderResult.runsIngested,
      openRouterSnapshotsIngested: orResult.snapshotsIngested,
      harborRunsIngested: harborResult.ingestedCount,
      swebenchRunsIngested: sweResult.ingestedCount,
      matchedModels: orResult.matchedModels,
      warmedCacheKeys: warmedKeys,
    };

    // 7. Mark job as completed
    await d1
      .prepare(
        `UPDATE ingest_jobs
         SET status = 'completed', completed_at = ?, summary = ?
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
      aiderRunsCount: aiderResult.runsIngested,
      openRouterSnapshotsCount: orResult.snapshotsIngested,
      harborRunsCount: harborResult.ingestedCount,
      swebenchRunsCount: sweResult.ingestedCount,
      warmedCacheKeys: warmedKeys,
    };
  } catch (err: any) {
    const failedAt = new Date().toISOString();
    console.error(`[Ingest] Job ${jobId} failed:`, err);

    try {
      await d1
        .prepare(
          `UPDATE ingest_jobs
           SET status = 'failed', completed_at = ?, summary = ?
           WHERE id = ?`
        )
        .bind(failedAt, JSON.stringify({ error: err?.message || String(err) }), jobId)
        .run();
    } catch (dbErr) {
      console.error("[Ingest] Failed to update ingest_jobs status on failure:", dbErr);
    }

    throw err;
  }
}

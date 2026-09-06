import handler from "@tanstack/react-start/server-entry";
import { runIngestPipeline } from "./ingest";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // Health endpoint: GET /api/ingest/health
    if (url.pathname === "/api/ingest/health") {
      try {
        const d1 = env?.DB;
        if (!d1) {
          return new Response(
            JSON.stringify({ status: "error", error: "Database binding DB missing" }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // 1. Last ingest job
        const lastJob = (await d1
          .prepare(
            `SELECT id, status, started_at, completed_at, error, summary
             FROM ingest_jobs
             ORDER BY started_at DESC
             LIMIT 1`
          )
          .first()) as {
          id?: string;
          status?: string;
          started_at?: string;
          completed_at?: string;
          error?: string | null;
          summary?: string | null;
        } | null;

        let jobError = lastJob?.error || null;
        if (!jobError && lastJob?.summary) {
          try {
            const parsed = JSON.parse(lastJob.summary);
            if (parsed.error) jobError = parsed.error;
          } catch {}
        }

        // 2. Run counts by benchmark slug
        const countsRes = await d1
          .prepare(
            `SELECT b.slug as benchmark_slug, bv.version, count(r.id) as count
             FROM benchmark_runs r
             JOIN benchmark_versions bv ON r.benchmark_version_id = bv.id
             JOIN benchmarks b ON bv.benchmark_id = b.id
             GROUP BY b.slug, bv.version`
          )
          .all();

        const runCounts: Record<string, number> = {};
        for (const row of (countsRes.results || []) as Array<{ benchmark_slug: string; count: number }>) {
          runCounts[row.benchmark_slug] = row.count;
        }

        // 3. Normalized vs reported cost counts
        const costCountsRes = (await d1
          .prepare(
            `SELECT
               sum(case when cost_usd_normalized is not null then 1 else 0 end) as normalized_count,
               sum(case when cost_usd_reported is not null then 1 else 0 end) as reported_count,
               count(*) as total_count
             FROM benchmark_runs`
          )
          .first()) as {
          normalized_count?: number;
          reported_count?: number;
          total_count?: number;
        } | null;

        const health = {
          status: lastJob?.status === "failed" ? "degraded" : "ok",
          last_job: lastJob?.status || "unknown",
          last_job_status: lastJob?.status || "unknown",
          lastJob: {
            id: lastJob?.id || null,
            status: lastJob?.status || "unknown",
            startedAt: lastJob?.started_at || null,
            completedAt: lastJob?.completed_at || null,
            error: jobError,
          },
          runCounts,
          breakdown: countsRes.results || [],
          restatedCostCount: costCountsRes?.normalized_count ?? 0,
          reportedCostCount: costCountsRes?.reported_count ?? 0,
          totalRuns: costCountsRes?.total_count ?? 0,
        };

        return new Response(JSON.stringify(health, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ status: "error", error: err?.message || String(err) }, null, 2),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Ingest pipeline endpoint: GET /api/ingest or GET /api/ingest/retry
    if (url.pathname === "/api/ingest" || url.pathname === "/api/ingest/retry" || url.pathname === "/__scheduled") {
      try {
        const isRetry = url.pathname === "/api/ingest/retry" || url.searchParams.get("retry") === "true";
        const rawAdapters = url.searchParams.get("adapters");
        const adapters = rawAdapters
          ? (rawAdapters.split(",").map((s) => s.trim()) as any)
          : undefined;

        const result = await runIngestPipeline({ env, ctx, retry: isRetry, adapters });
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err?.message || String(err) }, null, 2),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(event: any, env: any, ctx: any) {
    console.log(`[Scheduled] Ingest cron triggered: ${event.cron} at ${new Date().toISOString()}`);
    ctx.waitUntil(runIngestPipeline({ env, ctx }));
  },
};

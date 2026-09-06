# Pareto Cost Envelope & Cloudflare Workers Paid Billing Architecture

This document defines the strict cost envelope for the Pareto benchmark intelligence engine.
All pricing figures and included allotments were verified live against official Cloudflare documentation on **2026-09-05** at [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/).

---

## 1. Cloudflare Workers Paid Plan Allotments & 10% Red-Lines

Pareto runs exclusively within the **$5.00 / month Workers Paid base subscription**.
No second bill or paid add-on is permitted. To ensure zero overage, an operational **Red-Line is set at 10%** of each included monthly quota.

| Cloudflare Meter | Workers Paid Included Allotment | 10% Operational Red-Line | Pareto Architectural Enforcement |
| :--- | :--- | :--- | :--- |
| **Worker Requests** | **10,000,000** / month (+$0.30 / 1M) | **1,000,000** / month | Dynamic HTML / SSR routes through Worker. Client JS, CSS, fonts, and ECharts bundle chunks are served via **Static Assets** (free & unlimited). |
| **Worker CPU Time** | **30,000,000** CPU-ms / month (+$0.02 / 1M ms) | **3,000,000** CPU-ms / month | `limits.cpu_ms = 2000` enforced in `wrangler.jsonc`. KV caching ensures repeat explorer payloads require <5 ms CPU time. |
| **Static Assets** | **Unlimited** requests, unmetered bandwidth | Unmetered | All client bundles (`dist/client/assets/*.js`, `*.css`) and dynamically imported Apache ECharts chunk (`echarts-*.js`) served without Worker invocation. |
| **Workers KV Reads** | **10,000,000** keys read / month (+$0.50 / 1M) | **1,000,000** reads / month | 1 KV read per page request via canonical filter key (`explorer:{key}`). Fast retrieval with 0 D1 reads on hits. |
| **Workers KV Writes** | **1,000,000** keys written / month (+$5.00 / 1M) | **100,000** writes / month | Written only on cache miss or cache warming (`scripts/warm-cache.ts`) with `expirationTtl = 86400` (24 hours). Never written on hit. |
| **Workers KV Storage** | **1 GB** stored data (+$0.50 / GB-mo) | **100 MB** | Each explorer slice is ~12 KB compressed JSON. Entire active cache occupies <5 MB. |
| **D1 Rows Read** | **25,000,000,000** rows read / month (+$0.001 / 1M) | **2,500,000,000** rows read / month | D1 is removed from the hot path. Queried only on KV cache misses using indexed lookups (`benchmark_version_idx_runs`). |
| **D1 Rows Written** | **50,000,000** rows written / month (+$1.00 / 1M) | **5,000,000** rows written / month | Written only during seed and batch ingestion jobs (`scripts/seed.sql`). Zero runtime writes from user traffic. |
| **D1 Storage** | **5 GB** included (+$0.75 / GB-mo) | **500 MB** | Current seed catalog occupies <1 MB. |
| **Workers Logs** | **20,000,000** events / month (+$0.60 / 1M) | **2,000,000** events / month | Observability enabled with concise hit/miss telemetry. No per-row dumps or request body logs. |
| **Logpush** | 10M events included (Paid) | **0 (Disabled)** | Disabled. No Logpush pipelines configured. |
| **Queues / DO / R2 / Workflows** | Not used | **0 (Disabled)** | Excluded from the application stack. Zero cost. |
| **Cron Ingest** | **15 min CPU** / invocation (Paid included) | **1 invocation / day** | Configured in `wrangler.jsonc` as `0 6 * * *` (30 runs/month). Sequences Aider YAML, OpenRouter pricing, Harbor / tbench, and SWE-bench Verified (0 inference spend), batch D1 writes, warms default KV keys. |

---

## 2. Monthly Usage Models: 1k, 10k, and 100k Page Views (Including Daily Ingest Cron)

Assuming a conservative **90% KV cache hit rate** on user requests plus 1 automated daily ingest cron (`30` executions/mo, writing ~290 D1 rows/day across Aider, OpenRouter, Harbor, and SWE-bench):
- **Cache Hit**: 1 Worker Request, 1 KV Read, ~3–5 ms CPU, 0 D1 Rows Read, 0 D1 Rows Written.
- **Cache Miss**: 1 Worker Request, 2 KV Reads, 1 KV Write, ~12–15 ms CPU, ~14 D1 Rows Read (indexed), 0 D1 Rows Written.
- **Daily Ingest Cron**: 1 Cron Invocation/day, ~80–120 ms CPU, ~290 D1 Rows Written (batch), ~5 KV Writes (cache warming), 0 Inference Spend.

| Cloudflare Meter | 1,000 Views + Ingest | 10,000 Views + Ingest | 100,000 Views + Ingest | Included Paid Allotment | Red-Line Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Worker Requests / Crons** | 1,030 (0.01%) | 10,030 (0.1%) | 100,030 (1.0%) | 10,000,000 | **Inside Red-Line** (10.0% of 1M limit) |
| **Worker CPU-ms** | 9,600 ms (0.032%) | 63,600 ms (0.21%) | 553,600 ms (1.85%) | 30,000,000 ms | **Inside Red-Line** (18.5% of 3M limit) |
| **KV Reads** | 1,160 (0.012%) | 11,060 (0.11%) | 105,060 (1.05%) | 10,000,000 | **Inside Red-Line** (10.5% of 1M limit) |
| **KV Writes** | 250 (0.025%) | 1,150 (0.12%) | 5,150 (0.52%) | 1,000,000 | **Inside Red-Line** (5.2% of 100k limit) |
| **KV Storage** | ~3.5 MB | ~6.5 MB | ~18 MB | 1,000 MB (1 GB) | **Inside Red-Line** (18% of 100 MB limit) |
| **D1 Rows Read** | 10,400 (<0.0001%) | 23,000 (<0.0001%) | 79,000 (0.0003%) | 25,000,000,000 | **Inside Red-Line** (0.003% of 2.5B limit) |
| **D1 Rows Written** | 8,700 (0.017%) | 8,700 (0.017%) | 8,700 (0.017%) | 50,000,000 | **Inside Red-Line** (0.17% of 5M limit) |
| **Workers Logs** | 1,800 (0.009%) | 15,300 (0.077%) | 150,300 (0.75%) | 20,000,000 | **Inside Red-Line** (7.5% of 2M limit) |

At all modeled tiers (1k, 10k, and 100k views/month), **every meter stays strictly inside the 10% red-line**, guaranteeing zero overage and zero extra charges beyond the base $5/month Workers Paid fee.

---

## 3. Runtime Protection & Configuration Decisions

### `limits.cpu_ms = 2000`
In `wrangler.jsonc`, the execution limit is set to:
```jsonc
"limits": {
  "cpu_ms": 2000
}
```
- Standard HTTP SSR rendering with TanStack Start completes in 20–50 ms.
- 2,000 ms provides a 40x safety margin for startup and cold SSR rendering while strictly capping worst-case execution.
- Even in the event of an infinite loop bug or denial-of-wallet traffic, no single invocation can consume more than 2,000 CPU-ms (preventing rapid burn of the 30M CPU-ms bag).

### `upload_source_maps = true`
- Source maps are uploaded to Cloudflare for stack trace symbolication in Workers Logs and observability.
- Uploading source maps does **not** create a billable Cloudflare product or incur storage fees.

### Static Assets Offloading
- The client bundle and the Apache ECharts chunk (`dist/client/assets/echarts-*.js`, 1.12 MB uncompressed / 373 KB gzip) are served directly by Cloudflare Static Assets (`assets: { directory: "../client" }`).
- Requests to static assets are **free and unlimited**. They do not consume Worker requests or CPU time.

---

## 4. How to Inspect Usage Metrics in Cloudflare Dashboard

To monitor real-time consumption against the 10% red-line:

### 1. Workers & CPU Metrics
1. Open the Cloudflare Dashboard: `https://dash.cloudflare.com/`
2. Navigate to **Workers & Pages** > **Overview** > select `pareto`.
3. Select the **Metrics** tab.
4. Review:
   - **Requests**: Total incoming invocations (target: <1,000,000/mo).
   - **CPU Time**: Median and 99th percentile CPU time per request (target: <10 ms median).
   - **Errors**: HTTP 4xx / 5xx error rate.

### 2. D1 Row Metrics
1. In Cloudflare Dashboard, go to **Storage & Databases** > **D1 SQL Database** > select `pareto-catalog`.
2. Select **Metrics** > **Row Metrics**.
3. Review:
   - **Rows Read**: Daily / monthly scanned row volume (target: <2.5B/mo).
   - **Rows Written**: Total insert / update / delete row volume (target: <5M/mo).

### 3. Workers KV Metrics
1. In Cloudflare Dashboard, go to **Storage & Databases** > **KV** > select `pareto-frontier`.
2. Select **Metrics**.
3. Review:
   - **Read Operations**: Total key lookups (target: <1M/mo).
   - **Write Operations**: Cache put operations (target: <100k/mo).

---

## 5. D1 Query Plan Verification (`EXPLAIN QUERY PLAN`)

Verified on local D1 instance (`.wrangler/state/v3/d1`):
```sql
EXPLAIN QUERY PLAN 
SELECT benchmark_runs.id 
FROM benchmark_runs 
INNER JOIN models ON benchmark_runs.model_id = models.id 
INNER JOIN providers ON models.provider_id = providers.id 
INNER JOIN harness_versions ON benchmark_runs.harness_version_id = harness_versions.id 
INNER JOIN harnesses ON harness_versions.harness_id = harnesses.id 
INNER JOIN effort_presets ON benchmark_runs.effort_preset_id = effort_presets.id 
INNER JOIN sources ON benchmark_runs.source_id = sources.id 
WHERE benchmark_runs.benchmark_version_id = '01J8BV0000000000000000TB40';
```
**Execution Plan**:
```
SEARCH benchmark_runs USING INDEX benchmark_version_idx_runs (benchmark_version_id=?)
SEARCH models USING INDEX sqlite_autoindex_models_1 (id=?)
SEARCH harness_versions USING INDEX sqlite_autoindex_harness_versions_1 (id=?)
SEARCH harnesses USING COVERING INDEX sqlite_autoindex_harnesses_1 (id=?)
SEARCH providers USING COVERING INDEX sqlite_autoindex_providers_1 (id=?)
SEARCH effort_presets USING COVERING INDEX sqlite_autoindex_effort_presets_1 (id=?)
SEARCH sources USING COVERING INDEX sqlite_autoindex_sources_1 (id=?)
```
Result: **Zero full table scans**. All lookups utilize indexes or covering indexes.

---

## 6. Live Deployment & Verification Proof

- **Cloudflare Account ID**: `d21ed3776239ca64aa352ebd2d66cce2` (`Jubairjashim1975@gmail.com's Account`)
- **Production URL**: `https://pareto.jubairjashim1975.workers.dev`
- **Remote D1 Database**: `pareto-catalog` (`cf4eae17-f102-480d-9fe5-e5c281fd3198`)
  - Row Count: 14 compiled benchmark runs verified (`SELECT count(*) FROM benchmark_runs;`).
  - Hot Query EXPLAIN: Index `benchmark_version_idx_runs` verified remotely with 0 table scans.
- **Remote KV Namespace**: `pareto-frontier` (`350de0bd422c42b595873959266dfdd4`)
  - Active Keys: `explorer:01J8BV0000000000000000TB40:cb=reported:m=:h=:e=`, `catalog:benchmark_options`, `frontier:terminal-bench-4.0`.
  - Cache TTL: 86,400s (24 hours).
- **20 Sequential Production Requests Proof**:
  - Request 1 (cache warm): 1.77s (cold miss -> D1 query -> KV put)
  - Requests 2–20: 38ms – 63ms total edge latency (100% KV hits with 0 D1 reads)
  - Production Payload Confirmation:
    - Response contains `isCachedFrontier:!0` (boolean `true` serialized via seroval).
    - Knee point confirmed: GLM-5.3 (`isFrontier:!0`, `isKnee:!0`, solve rate 41.8%, $40.91/task).

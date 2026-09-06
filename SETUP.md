# Pareto Setup & Operations Guide

## Overview
- **Repository Path**: `/home/wertyp/Code/Personal/pareto`
- **Worker Name**: `pareto`
- **Cloudflare Account Name**: `Jubairjashim1975@gmail.com's Account`
- **Cloudflare Account ID**: `d21ed3776239ca64aa352ebd2d66cce2`
- **Production URL**: `https://pareto.jubairjashim1975.workers.dev`
- **D1 Database Name**: `pareto-catalog` (binding: `DB`, database_id: `cf4eae17-f102-480d-9fe5-e5c281fd3198`)
- **KV Namespace Name**: `pareto-frontier` (binding: `FRONTIER`, id: `350de0bd422c42b595873959266dfdd4`)
- **Daily Ingest Cron**: `0 6 * * *` (06:00 UTC daily)

---

## Application Routes & Surfaces

| Route | Description | Key Features |
| :--- | :--- | :--- |
| `/` | **Pareto Frontier Explorer** | Scatter plot, ranking table, multi-select filters (models, harnesses, efforts), cost basis toggle (`reported` vs `today`). |
| `/finder` | **Budget & Target Solver** | Inverse frontier solver: minimum cost to achieve target solve rate, or maximum solve rate under cost ceiling. |
| `/models/$slug` | **Model Profile** | Model card, cross-benchmark historical performance, harness breakdown, and cost restatement delta analysis. |
| `/compare` | **Head-to-Head Comparison** | Side-by-side model/configuration diff with cost, solve rate, token efficiency, and duration deltas. |
| `/runs/$id` | **Run Telemetry Inspector** | Full run details: task solve counts, tokens in/out, latency p50, pass@k JSON, reported vs normalized pricing. |
| `/methodology` | **Methodology Reference** | Mathematical foundations: Pareto dominance, knee-point detection, cost normalization formula, and canary rules. |
| `/api/ingest` | **Ingest Pipeline Trigger** | Automated/manual pipeline execution: fetches external benchmarks, restates costs, and warms KV cache. |
| `/api/ingest/health` | **Pipeline Health Endpoint** | Ingestion status, run counts, restatement coverage, per-source breakdown, and unmatched categorization. |

---

## Supported Benchmark Versions

| Benchmark Name | Benchmark Version ID | Version | Total Tasks (`n_tasks`) | Primary Source |
| :--- | :--- | :--- | :--- | :--- |
| **Terminal-Bench** | `01J8BV0000000000000000TB40` | `4.0` | 66 | Harbor / tbench leaderboard |
| **Terminal-Bench** | `01J8BV0000000000000000TB20` | `2.0` | 89 | Harbor / tbench leaderboard |
| **Aider Polyglot** | `01J8BV0000000000000AIDER10` | `1.0` | 225 | Aider Polyglot leaderboard YAML |
| **SWE-bench Verified** | `01J8BV000000000000000SWE10` | `1.0` | 500 | SWE-bench official results |
| **Datacurve DeepSWE** | `01J8BV000000000000DEEPSWE11` | `1.1` | 113 | Datacurve DeepSWE live leaderboard |

> [!NOTE]
> Denominator invariant: Solve rates are always computed against suite `n_tasks` (total benchmark size), never attempted tasks.

---

## Cache Architecture & Canonical Keys

Pareto enforces a strict KV-first hot path (`pareto-frontier`):
- **Canonical Key Format**:
  `explorer:<benchmarkVersionId>:cb=<costBasis>:m=<sortedModels>:h=<sortedHarnesses>:e=<sortedEfforts>`
- **Default TB 4.0 Keys**:
  - Reported: `explorer:01J8BV0000000000000000TB40:cb=reported:m=:h=:e=`
  - Today: `explorer:01J8BV0000000000000000TB40:cb=today:m=:h=:e=`
- **Default DeepSWE 1.1 Keys**:
  - Reported: `explorer:01J8BV000000000000DEEPSWE11:cb=reported:m=:h=:e=`
  - Today: `explorer:01J8BV000000000000DEEPSWE11:cb=today:m=:h=:e=`
- **Catalog Benchmark Options Key**: `catalog:benchmark_options`
- **Cache TTL**: 86,400 seconds (24 hours).
- **Dual Cache Warming**: Ingestion pipeline warms both `costBasis=reported` and `costBasis=today` for all default benchmark slices.

---

## Ingestion Pipeline & Daily Cron Architecture

Configured in `wrangler.jsonc`:
```jsonc
"triggers": {
  "crons": ["0 6 * * *"]
}
```

### Pipeline Execution Order:
1. **Aider Polyglot**: Ingests polyglot benchmark YAML results (~260 runs).
2. **OpenRouter Pricing Snapshot**: Ingests current pricing from `GET https://openrouter.ai/api/v1/models` (zero inference spend).
3. **Harbor / Terminal-Bench**: Ingests TB 4.0 and TB 2.0 evaluation runs.
4. **SWE-bench Verified**: Ingests verified benchmark runs.
5. **Datacurve DeepSWE v1.1**: Ingests live leaderboard JSON from `https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json`.
6. **Cost Restatement**: Evaluates runs with token telemetry against OpenRouter pricing snapshots and restates `cost_usd_normalized` and `cost_per_task_normalized`.
7. **Cache Warming**: Invalidates stale cache entries and warms default slices for all 5 benchmark versions in both `reported` and `today` bases.

### Health Endpoint Schema (`/api/ingest/health`):
```json
{
  "status": "ok",
  "lastRun": "2026-09-07T00:00:00.000Z",
  "totalRuns": 366,
  "restatedCostCount": 85,
  "breakdown": {
    "aider": 260,
    "harbor": 22,
    "swebench": 14,
    "deepswe": 70
  },
  "unmatched": {
    "no_alias": 18,
    "no_snapshot": 3,
    "no_tokens": 260
  }
}
```
- **Sum Invariant**: `restatedCostCount + unmatched.no_alias + unmatched.no_snapshot + unmatched.no_tokens == totalRuns`.

---

## Machine & Tool Versions
- **Operating System**: Linux (x86_64)
- **Node.js**: `v26.8.1` (managed via `mise`)
- **pnpm**: `11.25.0` (managed via `mise`)
- **Wrangler**: `4.129.0` (installed as devDependency)
- **Git**: `2.55.0`

---

## Operations Command Reference

### Local Development
```bash
# Start local development server with Cloudflare Workers runtime
npx wrangler dev --port 8787
```

### Build & Verification
```bash
# Run unit tests (metrics, finder, compare, restate, deepswe, etc.)
pnpm test --run

# Build client and SSR server bundles
pnpm build
```

### Database Migrations & Seeding
```bash
# Apply migrations to local D1
npx wrangler d1 migrations apply DB --local

# Apply migrations to production Cloudflare D1
npx wrangler d1 migrations apply DB --remote

# Seed local D1
npx wrangler d1 execute DB --local --file=scripts/seed.sql

# Seed production Cloudflare D1
npx wrangler d1 execute DB --remote --file=scripts/seed.sql
```

### Cloudflare Deployment
```bash
# Build and deploy Worker to production
pnpm deploy
```

### Ingest Pipeline & Telemetry Verification
```bash
# Trigger remote ingest pipeline manually
curl -s https://pareto.jubairjashim1975.workers.dev/api/ingest

# Inspect remote ingestion health and unmatched breakdown
curl -s https://pareto.jubairjashim1975.workers.dev/api/ingest/health | jq .
```

# Pareto Setup & Operations Guide (Phase 1)

## Overview
- **Repository Path**: `/home/wertyp/Code/Personal/pareto`
- **Worker Name**: `pareto`
- **Cloudflare Account Name**: `Jubairjashim1975@gmail.com's Account`
- **Cloudflare Account ID**: `d21ed3776239ca64aa352ebd2d66cce2`
- **Production URL**: `https://pareto.jubairjashim1975.workers.dev`
- **D1 Database Name**: `pareto-catalog` (binding: `DB`, database_id: `cf4eae17-f102-480d-9fe5-e5c281fd3198`)
- **KV Namespace Name**: `pareto-frontier` (binding: `FRONTIER`, id: `350de0bd422c42b595873959266dfdd4`)
- **Filtered Search URL Examples**:
  - Model subset: `https://pareto.jubairjashim1975.workers.dev/?costBasis=reported&models=glm-5-3&models=claude-opus-5`
  - Benchmark isolation: `https://pareto.jubairjashim1975.workers.dev/?benchmark=swe-bench-verified&costBasis=reported`
  - Local dev: `http://localhost:8787/?costBasis=reported&models=glm-5-3&models=claude-opus-5`

---

## Machine & Tool Versions
- **Operating System**: Linux (x86_64)
- **Node.js**: `v26.8.1` (managed via `mise`)
- **npm**: `11.19.0`
- **pnpm**: `11.25.0` (managed via `mise`)
- **Wrangler**: `4.129.0` (installed as project devDependency)
- **Git**: `2.55.0` (local repository initialized; `gh` installed but unauthenticated)

---

## Human Gates Encountered & Resolution

### Gate 1: Cloudflare Paid Account Transition (Resolved)
- Status: Successfully authenticated with OAuth device grant (`jubairjashim1975@gmail.com`, account `d21ed3776239ca64aa352ebd2d66cce2`).
- Permanent Infrastructure:
  - D1 database `pareto-catalog` created (`cf4eae17-f102-480d-9fe5-e5c281fd3198`).
  - KV namespace `pareto-frontier` created (`350de0bd422c42b595873959266dfdd4`).
  - Migrations and seed executed on remote D1.
  - Worker deployed to `https://pareto.jubairjashim1975.workers.dev`.
  - Cache warmed with `scripts/warm-cache.ts`. Verified 20 sequential requests hit KV with 0 D1 reads.

---

## Cache Architecture & Canonical Keys
Pareto operates with a KV-first hot path:
- **Canonical Key Format**: `explorer:<benchmarkVersionId>:cb=<costBasis>:m=<sortedModels>:h=<sortedHarnesses>:e=<sortedEfforts>`
- **Default TB 4.0 Key**: `explorer:01J8BV0000000000000000TB40:cb=reported:m=:h=:e=`
- **Catalog Benchmark Options Key**: `catalog:benchmark_options`
- **Backwards Compatible Key**: `frontier:terminal-bench-4.0`
- **Cache TTL**: 86,400 seconds (24 hours).
- **Cache Warming**:
  ```bash
  # Warm local dev instance
  pnpm run warm

  # Warm remote instance
  node scripts/warm-cache.ts --url=https://<your-worker>.workers.dev
  ```

---

## How to Read Usage in Cloudflare Dashboard
1. **Workers Requests & CPU**:
   - Navigate to `https://dash.cloudflare.com/` > **Workers & Pages** > `pareto` > **Metrics**.
   - Check request volume and CPU time per invocation (red-line: 1M req/mo, 3M CPU-ms/mo).
2. **D1 Row Reads & Writes**:
   - Navigate to **Storage & Databases** > **D1 SQL Database** > `pareto-catalog` > **Metrics** > **Row Metrics**.
   - Confirm repeat requests do not increment rows read (red-line: 2.5B rows read/mo).
3. **Workers KV Operations**:
   - Navigate to **Storage & Databases** > **KV** > `pareto-frontier` > **Metrics**.
   - Review read/write operations (red-line: 1M reads/mo, 100k writes/mo).

---

## Seed Data & Benchmark Provenance
- **Terminal-Bench 4.0** (`01J8BV0000000000000000TB40`, 66 tasks):
  - 10 compiled model runs seeded (`seed-compiled`, `official=0`):
    - GPT-5.6 Luna ($300 total, $4.55/task, 17.3% solve) — Frontier
    - GPT-5.6 Terra ($1700 total, $25.76/task, 21.5% solve) — Frontier
    - GPT-5.6 Sol ($2500 total, $37.88/task, 37.3% solve) — Frontier
    - GLM-5.3 ($2700 total, $40.91/task, 41.8% solve) — **⚡ Knee Point**
    - Opus 5 ($6000 total, $90.91/task, 51.8% solve) — Frontier
    - Fable 5 ($7300 total, $110.61/task, 44.5% solve) — Dominated
    - Opus 4.8 ($6500 total, $98.48/task, 23.6% solve) — Dominated
    - Sonnet 5 ($9600 total, $145.45/task, 12.4% solve) — Dominated
    - Grok 4.6 ($3600 total, $54.55/task, 20.3% solve) — Dominated
    - Grok 4.5 ($2100 total, $31.82/task, 12.4% solve) — Dominated
- **SWE-bench Verified 1.0** (`01J8BV000000000000000SWE10`, 500 tasks):
  - 4 synthetic slice runs seeded for benchmark selector verification and isolation.
- **Canary Notice**: Task prompts, questions, and test texts are strictly excluded from the repo.
- **Local D1 Verification**: Successfully seeded and verified (`SELECT count(*) FROM benchmark_runs` returns `14`).

---

## Operations Command Reference

### Local Development
```bash
# Start local development server with Cloudflare Workers runtime
npx wrangler dev --port 8787
```

### Build & Type Verification
```bash
# Build client and SSR server bundles
pnpm build

# Run unit tests (metrics golden fixtures & knee assertion)
pnpm test --run

# Regenerate Cloudflare worker configuration types
pnpm run cf-typegen
```

### Database Migrations
```bash
# Generate SQL migration from schema
pnpm drizzle-kit generate

# Apply migrations locally
npx wrangler d1 migrations apply DB --local

# Apply migrations to remote Cloudflare D1 (after wrangler login)
npx wrangler d1 migrations apply DB --remote
```

### Database Seeding
```bash
# Apply seed SQL to local D1
npx wrangler d1 execute DB --local --file=scripts/seed.sql

# Apply seed SQL to remote D1 (after wrangler login)
npx wrangler d1 execute DB --remote --file=scripts/seed.sql
```

### Cloudflare Deployment
```bash
# Build and deploy worker to *.workers.dev
pnpm deploy
```

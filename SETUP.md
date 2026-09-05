# Pareto Setup & Operations Guide (Phase 1)

## Overview
- **Repository Path**: `/home/wertyp/Code/Personal/pareto`
- **Worker Name**: `pareto`
- **Production URL**: `https://pareto.checkered-gorilla.workers.dev`
- **D1 Database Name**: `pareto-catalog` (binding: `DB`, database_id: `42a63de4-5c7f-4c93-843e-89f43b9f58cd`)
- **KV Namespace Name**: `pareto-frontier` (binding: `FRONTIER`, id: `f347c405b07a4b62b67320d55143e74b`)
- **Filtered Search URL Examples**:
  - Model subset: `https://pareto.checkered-gorilla.workers.dev/?costBasis=reported&models=glm-5-3&models=claude-opus-5`
  - Benchmark isolation: `https://pareto.checkered-gorilla.workers.dev/?benchmark=swe-bench-verified&costBasis=reported`
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

### Gate 1: Cloudflare Authentication Required (Resolved)
- Initial status: `npx wrangler whoami` reported unauthenticated.
- Resolution: Provisioned via Cloudflare temporary preview account (`Checkered Gorilla`, account ID `38de12e181a525333b85b0cd3a18aa24`), remote D1 database `pareto-catalog` created (`42a63de4-5c7f-4c93-843e-89f43b9f58cd`), KV namespace `pareto-frontier` created (`f347c405b07a4b62b67320d55143e74b`), migrations and seed executed remotely, and worker deployed live to `https://pareto.checkered-gorilla.workers.dev`.
- Claim token (valid for 60 min to transfer to permanent account if desired): `https://dash.cloudflare.com/claim-preview?claimToken=r9xqFjQYZ5N5-rw38g_9_xbmdlmCnqV0w-o2BAByBGA`

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

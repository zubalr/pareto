# Pareto — Agent Guidelines & Architecture Reference

This document outlines the locked stack, invariants, and operation protocols for the **Pareto** benchmark intelligence engine.

---

## 1. Locked Stack

- **App Framework**: TanStack Start + TanStack Router + TanStack Query + TanStack Table + TanStack Form
- **UI / Styling**: Tailwind CSS + dense operate-mode primitives (dark-first, no decorative gradients)
- **Charts**: Apache ECharts — strictly client-only via dynamic import and Vite SSR shim (`empty-echarts.ts`). Never bundle or import ECharts on the server.
- **Host**: Cloudflare Workers + Static Assets
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM (`drizzle-orm/d1`, `drizzle-kit`)
- **Cache**: Cloudflare KV namespace `pareto-frontier` (binding `FRONTIER`) for default frontier JSON
- **Runtime Configuration**: `wrangler.jsonc`, `compatibility_flags: ["nodejs_compat"]`, `compatibility_date`: 2026-09-05
- **Bindings**: Accessed via `import { env } from "cloudflare:workers"`
- **Worker Limits**: Single Worker entrypoint (`src/server.ts` exporting `fetch` from `@tanstack/react-start/server-entry`). Keep server graph small (<1 MB bundled). No `scheduled()`, queues, Durable Objects, Workflows, or external services in Phase 1.

---

## 2. Hard Invariants & Core Rules

### A. The Pareto-One-Bench Rule
A Pareto chart is **always** for exactly one `benchmark_version`.
- Cross-bench mixing on the scatter plot is a critical bug.
- Benchmark selection is single-choice and required.
- Points from different benchmark versions must never be mixed on the same coordinate space.

### B. Coverage-Flag Rule
Missing telemetry is tracked explicitly via boolean coverage flags:
- `hasTokens`, `hasCost`, `hasLatency`, `hasPassAtK`, `hasCi`
- Missing telemetry must **never** be coerced to `0` or drawn on the origin.
- Runs without cost (`cost === null` or `hasCost === 0`) must never appear on the scatter plot.
- When cost data is absent, the point is excluded from the frontier calculation and omitted from the chart.

### C. Denominator Invariant
The solve rate denominator is suite `n_tasks` (total benchmark size), **never** the number of attempted tasks. Unattempted or failed tasks count as unsolved.

### D. Benchmark Task Canary
Terminal-Bench (and SWE-bench) task prompts, statements, test cases, and solutions must **never** be copied into this repository. Only aggregate metrics and metadata are cataloged.

### E. The KV-First Hot Path Rule
D1 is the durable source of truth, **not** the hot path for page views.
- Every explorer view checks Workers KV (`FRONTIER`) first via canonical key:
  `explorer:<benchmarkVersionId>:cb=<costBasis>:m=<sortedModels>:h=<sortedHarnesses>:e=<sortedEfforts>`
- On KV hit, the payload is returned immediately with `isCachedFrontier: true` (0 D1 reads, <5ms CPU).
- On KV miss, query D1 with indexed filter `benchmark_version_idx_runs`, calculate metrics, and write to KV with `expirationTtl >= 86400` (24h).
- Default TB 4.0 key: `explorer:01J8BV0000000000000000TB40:cb=reported:m=:h=:e=`.

### F. Cost Envelope & CPU Cap Invariant
- App runs within Workers Paid included allotments only (base $5/mo).
- CPU is capped at `limits.cpu_ms = 2000` in `wrangler.jsonc` to prevent runaway consumption.
- Client bundles and Apache ECharts chunk are served free via Cloudflare Static Assets.
- Refer to `COST.md` for the 10% red-line budget and usage tracking runbook.

---

## 3. Development & Operations Runbook

### Environment Preconditions
- Node.js: `v26.8.1` (via `mise`)
- Package Manager: `pnpm` (`v11.25.0`)
- Cloudflare CLI: `npx wrangler` (`v4.129.0`)

### Local Development
```bash
# Run local dev server with full SSR and local D1/KV bindings
npx wrangler dev --port 8787
```

### Building the Application
```bash
# Runs vite build for both client and SSR server environments
pnpm build
```

### Running Tests
```bash
# Run metrics and unit tests
pnpm test --run
```

### Database Migrations (D1 + Drizzle)
```bash
# Generate SQL migrations after modifying src/db/schema.ts
pnpm drizzle-kit generate

# Apply migrations to local D1 instance
npx wrangler d1 migrations apply DB --local

# Apply migrations to production Cloudflare D1
npx wrangler d1 migrations apply DB --remote
```

### Seeding Data
```bash
# Seed local D1 database
npx wrangler d1 execute DB --local --file=scripts/seed.sql

# Seed production Cloudflare D1 database
npx wrangler d1 execute DB --remote --file=scripts/seed.sql
```

### Deploying to Cloudflare Workers
```bash
pnpm deploy
# Equivalent to: pnpm build && npx wrangler deploy
```

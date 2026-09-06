# Contributing to Pareto

Short version: the board is honest or it is broken. The rules below exist to keep it
that way. `AGENTS.md` is the full architecture reference; this file covers what a
code/data contribution touches.

## Ground rules

- **Locked stack.** TanStack Start/Router/Query/Table/Form, Tailwind, client-only
  ECharts. No new chart/UI libraries; no new Cloudflare products or bindings.
- **Aggregate only (canary).** Benchmark task prompts, statements, test cases, and
  solutions must never be committed, stored, or fetched into the repo — especially
  Terminal-Bench and SWE-bench task text. Adapters keep aggregates and coverage flags
  only.
- **Missing telemetry is never zero.** A run without cost, tokens, latency, or pass@k
  is omitted from that encoding and flagged via the `has_*` coverage booleans.
- **One `benchmark_version` per chart.** Cross-benchmark mixing is a critical bug.
- **Reported cost is primary.** Today (restated) pricing is a separate, coverage-gated
  number; it never silently substitutes reported.

## Adding a source adapter (TypeScript)

Adapters live in `src/ingest/` and turn one public source into canonical rows.
Source research, URLs, licenses, and field mappings are catalogued in
`docs/sources.md` — read the family's section before writing code.

1. **Create `src/ingest/<source>.ts`** exporting a `SourceAdapter`: a function that
   fetches the public payload and returns `CanonicalRun[]` (see
   `src/ingest/types.ts`). One adapter = one upstream source; do no scraping of
   HTML that has a structured alternative.
2. **Map fields honestly.** Fill only what the source actually provides and set the
   coverage flags (`hasTokens`, `hasCost`, `hasLatency`, `hasPassAtK`, `hasCi`)
   accordingly. Absent data stays absent — never coerce `0`.
3. **One `benchmark_version` per row.** Resolve/create the `(benchmark, version)`
   pair and stamp `benchmarkVersionId`; the app's per-chart isolation depends on it.
4. **Keep a stable `sourceRunId`** — `(sourceId, sourceRunId)` is the unique/dedupe
   key. Provenance is the product; unattributable numbers do not ship.
5. **Strip task text before persisting.** Keep aggregates (counts, rates, costs,
   tokens) and canary markings; drop prompts/tests/trajectories at the adapter
   boundary.
6. **Cost fields:** `cost_usd_reported` (+ `cost_per_task_reported = total / n_tasks`)
   is what the run published; only fill `cost_usd_normalized` when you have a real
   restatement (e.g. OpenRouter list pricing × token counts).
7. **Register the adapter** in `src/ingest/index.ts`, add a unit test with a fixture
   snippet of the real payload shape, and run `pnpm test --run`.

## UI changes

- Respect the encodings in `DESIGN.md` (color/opacity rules, coverage empty states,
  log-scale cost axis). If you change an encoding, update `DESIGN.md` in the same PR.
- All filter/pin/chart-slot state lives in URL search params and must round-trip.
- `pnpm test --run` and `pnpm build` must pass before review.

## Reporting bad numbers

Open an issue with the run id (`/runs/$id` URL) and what you believe is wrong. Every
board point links back to its `sourceRunId`, so corrections land upstream first.

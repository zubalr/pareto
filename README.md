# Pareto

**Abandoned.** This project is not deployed. On 2026-09-09 the Cloudflare Worker, D1 database (`pareto-catalog`), and KV namespace (`pareto-frontier`) were deleted. The daily ingest cron is gone. There is no live board.

Do not `wrangler deploy` this repo. That would create a new Worker and start using quota again.

What follows is a snapshot of the last local tree (Phase 12).

## Pick — the front door

`/` is **Pick**: choose what you're doing (coding · general · math · science) and what
you can spend, and get **one answer** — model, effort, harness, expected score, cost,
and provenance — plus one cheaper alternative and one stronger over-budget option.

- **Coding** runs against live D1 (DeepSWE 1.1 by default; GitHub bugs via
  SWE-bench Verified) with measured $/task from official leaderboard ingests.
- **General / math / science** read a compiled, attributed public snapshot
  (MMLU-Pro · AIME 2026 · SciCode); budget there caps the OpenRouter list
  **$/M output — a price proxy, never $/task**, and rows without a price are
  omitted rather than zeroed.
- The **default theme is light** (paper, green accent, blue knee); dark remains a
  toggle for operators. Charts render light from first paint — never an empty box.

## Freshness law (Phase 12)

Models move every week. **Only boards whose upstream leaderboard last published on or
after 2026-03-08 are recommended** — and only if they are not frozen, deprecated,
superseded, or retired-as-saturated. Kept: DeepSWE 1.1 (2026-09-07), MMLU-Pro
(2026-03-11), AIME 2026 (live), SciCode (2026-08-28), SWE-bench Verified (2026-09-03).
Thrown from Pick and selectors: AIME 2025 (frozen), GPQA Diamond (saturated), Aider
Polyglot (upstream stale since 2025-10), Harbor TB 2.0 (superseded by TB 4.0), and the
TB 4.0 seed fixtures (not a living board). Buried `?benchmark=` URLs for retired ids
still resolve so links don't 404 — they just never appear as options. Verdicts and
dates: `src/domains/registry.ts`.

The **Explorer board** (`/explore`, default board **DeepSWE 1.1**) stays for operators:
one point is one *configuration run* —
`benchmark version × model × provider × harness version × effort preset → source run`.
Every number keeps its provenance (`sourceRunId`, official/compiled flag) and every
telemetry gap is an explicit coverage flag — missing cost, tokens, or latency is
**omitted, never plotted as zero**. Old `/?benchmark=…` URLs redirect to `/explore`.

## Core invariants

- **One benchmark per chart.** The benchmark selector is required and single-choice;
  points from different `benchmark_version`s never share a coordinate space. Pins from
  another board cannot enter a compare matrix — they show up in a "Not on …" note.
- **Dual cost basis, honestly.** *Reported* is the primary number (priced as published
  with the run). *Today* re-prices from normalized snapshots; a run without a restated
  price is **omitted** from Today views and shown "not restated" — never substituted
  with the reported price, never drawn at $0.
- **Denominator invariant.** Solve rate = `n_solved / n_tasks` (full suite). Failed,
  errored, or unattempted tasks count as unsolved.
- **Aggregate only.** No benchmark task prompts, statements, test cases, or solutions
  ever enter this repo or its database.
- **Geometric, not editorial.** The Pareto frontier and the Kneedle knee are computed,
  not curated; the Finder is a deterministic budget filter with a stated ranking rule.

## Routes

| Route | What it does |
|---|---|
| `/` | **Pick** (default, light theme) — domain → budget → one model × effort answer with provenance, cheaper alternative, and over-budget next step |
| `/explore` | Explorer — Pareto scatter (frontier + knee, color by harness/effort), Pass@k / Effort / Resources slots, filter rail, configurations table, multi-pin. Default board **DeepSWE 1.1**. Selector lists freshness-law KEEP boards only; retired slices stay reachable via buried `?benchmark=` URLs and are never defaults |
| `/finder` | Budget filter: max $/task (+ optional p50 cap) under three intents — max solve, min $/resolved, cheapest at a solve floor |
| `/compare` | 2–8 pinned configurations side by side, same benchmark only |
| `/models/$slug` | One base model across harnesses and efforts |
| `/runs/$id` | Full dossier for one run, with provenance and both cost bases |
| `/methodology` | Pick, formulas, domination/knee rules, coverage semantics, provenance, canary |

## Stack

TanStack Start + Router + Query + Table · Tailwind CSS (light-first) ·
Apache ECharts (client-only, dynamically imported — never bundled on the server) ·
Cloudflare Workers + D1 + KV.

## Run it locally

```bash
pnpm install
pnpm drizzle-kit generate            # after schema edits
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --file=scripts/seed.sql
npx wrangler dev --port 8787         # http://localhost:8787
pnpm test --run                      # unit tests (metrics, finder, compare, health)
pnpm build                           # client + SSR bundles
pnpm deploy                          # wrangler deploy (needs account auth)
```

Requires Node 20+ (repo uses mise, Node 26) and pnpm.

## Data

Rows are ingested from public sources (Aider polyglot leaderboard YAML, Harbor /
Terminal-Bench submission JSON, SWE-bench experiments, OpenRouter pricing metadata) by
scheduled adapters. Source research, licenses, and field mappings:
[`docs/sources.md`](docs/sources.md). Design decisions and encodings:
[`DESIGN.md`](DESIGN.md). Numbers on the board are aggregates from those sources or
compiled seed fixtures — **not an official leaderboard**.

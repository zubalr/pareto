# Pareto — benchmark cost vs solve intelligence

[![Live board](https://img.shields.io/badge/live-board-10b981)](https://pareto.jubairjashim1975.workers.dev)
[![Today basis](https://img.shields.io/badge/cost-reported_%7C_today-06b6d4)](https://pareto.jubairjashim1975.workers.dev/?costBasis=today)

A dense, dark, operate-mode board that answers one question in ten seconds:
**who is on the Pareto frontier, where is the knee, and what does it cost?**

Live: **https://pareto.jubairjashim1975.workers.dev**

One point on the board is one *configuration run*:
`benchmark version × model × provider × harness version × effort preset → source run`.
Every number keeps its provenance (`sourceRunId`, official/compiled flag) and every
telemetry gap is an explicit coverage flag — missing cost, tokens, or latency is
**omitted, never plotted as zero**.

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
| `/` | Explorer: Pareto scatter (frontier + knee), Pass@k / Effort / Resources slots, filter rail, configurations table, multi-pin |
| `/finder` | Budget filter: max $/task (+ optional p50 cap) under three intents — max solve, min $/resolved, cheapest at a solve floor |
| `/compare` | 2–8 pinned configurations side by side, same benchmark only |
| `/models/$slug` | One base model across harnesses and efforts |
| `/runs/$id` | Full dossier for one run, with provenance and both cost bases |
| `/methodology` | Formulas, domination/knee rules, coverage semantics, provenance, canary |

## Stack

TanStack Start + Router + Query + Table · Tailwind CSS (dark-first) ·
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

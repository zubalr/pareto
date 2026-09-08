# DESIGN.md — Pareto, Phase 11 (Pick)

Design record for the product: the Pick recommendation surface, the Explorer board's
layout and chart encodings, color/opacity rules, empty & coverage states, and the
specification for future charts. Written so the next session (human or agent) can
reconstruct every visual decision without re-deriving it.

**Status: Phase 11.** `/` is **Pick** — light-first, vibrant, domain → budget → one
answer. The Explorer board lives at `/explore` (old `/?benchmark=…` URLs redirect
there, params preserved). Phase 10 theme toggle, CSV export, skip link, density, and
how-to-read carry over. **Default theme is now light**; dark remains an operator
toggle, not the first impression.

---

## 0. Pick — the front door (`/`)

A stranger should not learn "benchmark versions." Pick asks two questions — *what are
you doing?* (domain) and *what can you spend?* — and answers with **one
configuration**: model, effort, harness (if agentic), expected score, cost, provenance,
and why, plus one cheaper alternative and one stronger over-budget option. URL shape:
`/?domain=coding|general|math|science&budget=…&floor=…&intent=…&objective=…`.

### Domain → bench map (fixed; do not improvise)

| Domain | Primary board (Pick uses this) | Sub-intents | Cost semantics |
|---|---|---|---|
| **Coding** | DeepSWE 1.1 (113, live D1) | Terminal (Harbor TB 2.0) · Polyglot (Aider) · GitHub bugs (SWE-bench Verified) | measured $/task (reported) |
| **General** | MMLU-Pro (TIGER-Lab snapshot) | — (IFEval absent from snapshot) | list $/M output — **price proxy, not $/task** |
| **Math** | AIME 2025 (MathArena frozen snapshot) | — | list $/M output — price proxy |
| **Science** | SciCode (Kaggle Open Benchmarks snapshot) | GPQA Diamond (**saturated**, ~95% top) | list $/M output — price proxy |

- **Coding is wired to live D1** via the read-only Finder server fn; the agentic slice
  is matched at `max` effort for comparability. When the winning model has an `xhigh`
  run on the same bench, it appears as the separate "spend more" alternative — never
  mixed into the same sentence as the max answer. Terminal/Polyglot/GitHub intents use
  all-effort slices; every answer still names its effort.
- **General/math/science read a compiled, attributed snapshot**
  (`src/data/compiled-domain-scores.ts`, < 150 KB, retrieved 2026-09-08; sources,
  licenses, and staleness notes inline in `COMPILED_SOURCES`). Not a cron. Snapshot
  rows map onto existing D1 slugs when the model is obviously the same, so snapshot
  answers keep dossier links.
- **Proxy rule:** snapshot budgets cap OpenRouter list $/M output — labeled
  "price proxy, not $/task" everywhere it appears. Rows without a price are omitted
  from budget filtering (the same rule as a coding run without cost telemetry), never
  priced at zero.
- **One ranker.** Pick calls `selectFinder` (`src/finder.ts`) on the active slice; the
  quality floor is a hard pre-filter applied before ranking (below-floor runs are
  excluded, never silently accepted). `src/pick.ts` adds only the framing: cheaper
  alternative (strictly cheaper eligible run), stronger over-budget option (cheapest
  over-budget run that outscores the answer), xhigh upgrade (same model, higher
  effort). Worked example (live D1): coding → $2/task → 50% floor → best = GLM-5.3
  Flash (max · 63.4% · $0.48/task · `01J8RUNDS6314BEDBMINISWEAG`), cheaper = DeepSeek
  V4 Flash (53.3% · $0.10/task), over-budget step = GPT-5.6 Luna (67.2% · $3.03/task).
- **Same-bench only:** an answer links to the dossier and Explorer board of exactly
  one benchmark version (Pareto-One-Bench rule). Snapshot answers cite the source
  table + retrieved date instead of a D1 link.
- **Redirect:** any legacy Explorer param on `/` (`benchmark`, `models`, `harnesses`,
  `efforts`, `costBasis`, `pinned`, `chart`, `effortMatch`, `colorBy`, `density`)
  307s to `/explore` with the params preserved.
- **Mobile:** domain cards stack; the answer card renders before the controls.

---

## 1. Layout

Operate-mode dashboard at `/explore` (light paper world by default now; dark toggle retained). Reference points:
Artificial Analysis density, SWE-bench / tbench.ai honesty. No decorative gradients,
no emoji-as-icon (lucide-react icons only). One screen, reading order top-to-bottom:

```
┌────────────────────────────────────────────────────────────────────┐
│ banner: "compiled seed data — not an official leaderboard" + links │  (required, never removed)
├──────────┬─────────────────────────────────────────────────────────┤
│ filter   │ status strip: Benchmark · Configurations · Cost basis · │
│ rail     │               KNEE callout (cyan, the only loud card)   │
│ (w-60)   ├─────────────────────────────────────────────────────────┤
│          │ Pareto scatter — the focal surface, 440px tall          │
│ benchmark│─────────────────────────────────────────────────────────│
│ cost     │ pass@k slot (coverage-gated; quiet empty state today)   │
│ models   │─────────────────────────────────────────────────────────│
│ harnesses│ configurations table (sortable, config column pinned)   │
│ effort   │                                                         │
└──────────┴─────────────────────────────────────────────────────────┘
```

- The chart is the focal surface. The knee callout is a small card in the strip, not a
  hero: it answers "where is the knee" in one glance, then hands attention to the chart.
  No trophy, no rank-#1 treatment anywhere — ranked leaderboards are not this product.
- Status strip tiles: Benchmark (name, version, `n_tasks`), Configurations (visible /
  on frontier / plotted), Cost basis (`$/task = total ÷ n_tasks`), Knee (model,
  harness · effort, solve% @ $/task, and the **next frontier step** line:
  `+$Δ/task → +Δ pts (model)` — the marginal price of the next accuracy step).
- Filter rail: benchmark selector is visually required (emerald border, "required"
  hint) because the Pareto-One-Bench Rule depends on it. Below: cost basis toggle,
  then multi-selects for models / harnesses / effort with `all` or `n/N` hints.
  Empty multi-select semantics stated in-rail: **empty = all configurations with data**.
- **Chart slot switcher (Phase 2)**: above the chart card, tabs `Pareto | Pass@k | Effort`
  write the `?chart=` search param (Pareto is the default and clears the param to keep
  URLs clean). Tabs for slots with no eligible telemetry carry a quiet `EMPTY` badge;
  selecting one shows the coverage empty state, never a fabricated chart (§6).
- **URL is the source of truth.** Every filter, the pin, the cost basis, and the chart
  slot live in search params (`?benchmark=&models=&harnesses=&efforts=&costBasis=&pinned=&chart=`);
  filtered URLs round-trip through `validateSearch`. Note: TanStack Router parses
  numeric-looking params as numbers, so all route validators coerce params back to
  strings (a `?maxCost=33` must not silently vanish on the next navigate — this bug
  was found in browser QA and fixed, see §10).
- Banner stays: numbers are compiled/seed, not an official leaderboard.
- Nav header links Pick (`/`, the product front door) / Explorer (`/explore`) / Finder / Compare / Methodology.

## 2. Scatter encodings

Implemented in `src/components/ParetoChart.tsx`. Chart is Apache ECharts, client-only
(dynamic import; SSR gets `empty-echarts.ts` shim — never bundle ECharts server-side).

- **X = USD per task, log scale (base 10).** Seed costs span $4.55–$145.45/task on TB
  4.0; on a linear axis every cheap point collapses against the origin, which is
  exactly where the interesting frontier lives. Bounds: `min = minCost/2`,
  `max = maxCost × 1.25` (half-decade below, ~20% above; degenerate single-cost slices
  get symmetric padding). Axis title names the basis: "USD per task (log)".
- **Y = solve rate (%), linear, 0 to `niceCeil(maxSolve × 1.1, 10)`.** Baseline at 0 is
  kept because solve rate is a ratio against the full suite (Denominator Invariant);
  truncating it would exaggerate small differences.
- **Frontier polyline** connects undominated points only, sorted by cost ascending,
  emerald `#10b981`, 2px, drawn under the points (z:2). Points lacking positive cost
  never enter the polyline (Coverage-Flag Rule).
- **Knee** marked on the frontier with a two-line label: `KNEE — <model>` over
  `<harness> · <effort> · <$X/task> · <Y%>`, cyan-on-dark-teal chip. The default TB 4.0
  seed knee is GLM-5.3 (Claude Code · max · $40.91/task · 41.8%).
- **Tooltip** (item trigger): model (bold) → provider · harness [+version] · effort →
  solve rate with `nSolved/nTotal` → $/task in the active basis (alt basis dimmed) →
  total run cost → latency p50 when present → status (KNEE / FRONTIER / DOMINATED) →
  five coverage flags (`TOK USD LAT P@K CI`, ✓ present / – missing) → source name with
  official/compiled marker → "click to pin" hint.
- **Interaction**: click a point to pin (writes `?pinned=`, amber ring); hover syncs
  with table rows through shared `hoveredId` state in both directions.

## 3. Color / opacity rules

Quiet dominated, loud frontier, one focal knee. Nothing else may compete.

| Element            | Fill                | Border           | Size | Opacity |
|--------------------|---------------------|------------------|------|---------|
| Dominated point    | `#52525b` (zinc-6)  | `#18181b` 1px    | 7    | 0.45    |
| Frontier point     | `#10b981` (emerald) | `#064e3b` 1.5px  | 11   | 1.0     |
| Knee point         | `#06b6d4` (cyan)    | white 2px        | 16   | 1.0     |
| Pinned point       | inherits status     | amber `#f59e0b` 3px | ≥14 | 1.0   |
| Hovered point      | inherits status     | inherits         | +5   | 1.0     |
| Frontier polyline  | emerald 2px, 0.9    | —                | —    | —       |

- Dominated points are intentionally *boring*: small, gray, translucent. They must be
  findable (tooltip still works) but never compete with the frontier for attention.
- State priority when stacked: knee > pinned > frontier > hovered > dominated.
- Accent colors are semantic and sparse: emerald = frontier/positive, cyan = knee,
  amber = pin, red = errors only. No gradients, no glows except a soft shadow on the
  knee/pin to lift them off the grid.

## 4. Empty & coverage states

- **Filter empties the slice** (0 runs): chart card shows "No runs match the current
  filters." + hint to clear filters; table shows the empty-multi-select semantics.
- **Runs exist, none report cost**: scatter is *suppressed*, not drawn at zero:
  "N run(s) visible, none with reported cost — scatter suppressed. Missing cost is
  never plotted as $0." Table still lists the runs; coverage chips show USD dimmed.
- **Coverage chips** (`TOK USD LAT P@K CI`): present = lit zinc chip; missing = hollow,
  dimmed, lowercase chip with explanatory `title`. A chip is a fact about telemetry,
  never a value substitution.
- **Chart header count**: `plotted/total` is always visible so a suppressed or
  filtered-down scatter can't silently masquerade as the whole board.
- **Pass@k slot**: implemented as a chart tab (§8 notes); with no `has_pass_at_k`
  rows in the slice it renders the quiet empty state ("no pass@k telemetry in this
  slice; chart suppressed rather than fabricated") and the tab carries an `EMPTY`
  badge. The day pass@k data lands (Aider ingest), the slot renders the ladder —
  k vs cumulative solve, one series per configuration. No lying chart, ever.

## 5. Table

`src/components/DataTable.tsx`, TanStack Table.

- **Configuration column pinned** (CSS `position: sticky; left: 0` with solid row
  backgrounds so scrolled columns slide underneath). It carries the run grain: model +
  pin indicator (lucide `Pin`, amber) over harness / effort chip.
- Columns: Status · Configuration (pinned) · Solve rate (with `nSolved/nTotal` and a
  mini-bar) · $/task (basis-aware) · **$/resolved** (`total ÷ n_solved`, the amortized
  number — shown for transparency, deliberately *not* a chart axis) · Total $ ·
  Coverage chips · Source (● official / ○ compiled).
- Sortable: solve rate, $/task, $/resolved (plus status and total $). Default sort:
  solve rate desc.
- Status badges: `KNEE` (cyan) / `FRONTIER` (emerald) / `DOMINATED` (quiet zinc) —
  same semantics as the chart, so table and chart always agree.
- Row hover ↔ chart highlight, click-to-pin: identical shared state as the chart.
  Knee row carries a faint cyan wash; pinned row an amber left border.

## 6. Future chart specs (specify now, implement only with real data)

All three share the house rules: one benchmark version per chart, coverage-gated
(missing telemetry removes a point from that encoding, never zero-fills), theme-aware
palette, dominated/secondary series quiet per §3.

### 6.1 Pass@k ladder
- **Trigger**: any run with `has_pass_at_k = 1` and non-empty `pass_at_k` JSON.
- **Encoding**: X = k (1..K, linear), Y = cumulative solve rate (%). One series per
  configuration (model + harness + effort); frontier members solid 2px, others 1px at
  0.4 opacity, cap visible series at ~8 with a rail of toggles if crowded.
- **Read**: k-shifted supply curve of a model against its own sampling budget.
  Monotone non-decreasing; plateau = capability ceiling.
- **Example**: GLM-5.3 series `{k:1: 27.3, k:2: 33.3, k:4: 37.9, k:8: 41.8}` rendered
  as a step line; knee model gets the cyan accent.
- **Status**: seed `pass_at_k` is `{}` everywhere → empty state only (§4).

### 6.2 Effort curve
- **Trigger**: a model+harness pair with ≥2 distinct effort presets in one benchmark.
- **Encoding**: X = effort preset (ordinal low → medium → high → max), Y = solve rate
  (%); a second panel or dual encoding shows $/task on the same ordinal X. Connected
  points per model+harness; the effort that lands on the global Pareto frontier is
  ringed in emerald.
- **Read**: "does buying reasoning effort pay for itself" — the slope of solve vs
  effort next to the slope of cost vs effort.
- **Example**: GLM-5.3 · Claude Code: low (22.1%, $12/task) → high (31.5%, $24/task) →
  max (41.8%, $40.91/task).

### 6.3 Resource multipliers vs baseline — REVISED & SHIPPED (Phase 3)
- **Shipped encoding** (supersedes the solve-delta sketch below, which needed
  paired-effort data the real sources rarely provide): grouped bars — x = metric
  group (USD/task, Tokens, Wall-clock p50), bars = configurations, value =
  **multiplier vs the baseline** (baseline = 1.0×, dashed reference line).
- **Baseline** = cheapest configuration with positive reported cost in the slice.
- **Coverage gating**: a configuration without a metric's telemetry gets no bar in
  that group; if the *baseline* lacks the metric, the whole group is suppressed with
  an explicit note ("Baseline lacks token telemetry — tokens group suppressed") — a
  multiplier against an unmeasured baseline would be fabricated. Fewer than two
  costed configurations ⇒ honest empty state.
- **Cap**: frontier-first then best-solve, 8 configs, with "N not drawn" note (Aider
  slices have 51+ costed rows).
- **Read**: which configuration pays how many times the cheapest one for cost,
  tokens, or wall-clock. Original solve-delta sketch retained for reference: points
  at (resource multiplier, solve-delta vs baseline) once paired-effort data exists.

## 8. Finder (`/finder`) — Phase 2

A deterministic budget filter over one benchmark version. It is explicitly **not** a
recommender: it applies the researcher's constraint, states its ranking rule, and shows
its exclusions. Selection logic is a pure module (`src/finder.ts`, unit-tested in
`test/finder.test.ts`); the route reads the slice via the read-only
`getFinderData` server function (D1 only, no KV writes).

- **Inputs** (all URL params): `benchmark` (required, single), `maxCost` ($/task cap),
  `maxLatency` (optional p50 seconds cap), `objective` = `max-solve` (default) or
  `min-cost-per-resolved`. Quick presets $10/$25/$50/$100.
- **Eligibility**: reported cost basis only — a cap in Today-basis dollars cannot be
  checked honestly until normalized pricing covers every row. A run qualifies only
  with positive reported cost ≤ cap; missing cost ⇒ excluded (`no-cost-telemetry`),
  never assumed within budget. A latency cap excludes unmeasured runs
  (`no-latency-telemetry`) and over-cap runs.
- **Ranking**: `max-solve` → solve rate desc; `min-cost-per-resolved` →
  `costUsdTotal / nSolved` asc (needs `nSolved > 0`, else `unrankable`). Ties break on
  cost, then run id — deterministic and reproducible from the URL.
- **Output**: the winning run as a full config card (model, harness · effort, solve,
  $/task, $/resolved, total, p50, provenance: source name ●/○ and `sourceRunId`, link
  to `/models/{slug}`), up to two alternatives (ranked next, different models
  preferred so the choice is real), and an exclusion ledger table with per-run
  reasons. When nothing qualifies, the empty state names the closest over-budget run
  and its delta.
- **Worked example ($50 TB 4.0 seed, documented acceptance case)**: 5 of 10 runs
  excluded for budget (Opus 5 $90.91, Opus 4.8 $98.48, Fable 5 $110.61, Sonnet 5
  $145.45, Grok 4.6 $54.55); **GLM-5.3 wins max-solve at 41.8% ($40.91/task)**,
  alternatives GPT-5.6 Sol (37.3%) and Terra (21.5%). Switching to min-$/resolved
  crowns GPT-5.6 Luna at $27.27 per resolved task (11 resolved, $300 total) — the
  amortized metric rewards cheap partial success, which is why it is table-only on
  the Explorer.
- **Live Aider data**: with Aider Polyglot 1.0 ingested (69 runs, 225 tasks,
  `source = Aider Polyglot Leaderboard`, all rows `has_pass_at_k = 1`,
  `pass_at_k = {"1": x, "2": y}`), the same rules apply unchanged; free models
  (`cost = 0`, e.g. local models) are excluded from budget checks as
  `no-cost-telemetry`-equivalent (cost ≤ 0 is not a verifiable budget fit and cannot
  sit on the log scatter).

## 9. Model page (`/models/$slug`) — Phase 2

One base model across harnesses/efforts on a single benchmark version (search param
`benchmark`, default TB 4.0). Read-only `getModelData` server function computes the
bench-wide frontier/knee (reported basis) and returns the model's runs in that
context, plus the bench frontier polyline for background.

- Stat tiles: runs on the slice (vs total), best solve, cheapest $/task, count on
  frontier.
- **Movement chart**: this model's runs as points on the log-$ scatter (knee cyan,
  frontier emerald, dominated gray), with the bench frontier dashed behind — "how the
  model moves across harnesses and efforts" against the board it came from.
  Suppressed when the model has no positive cost (coverage rule).
- Table: harness [+version], effort, solve (n/n), $/task, $/resolved, p50, **pass@k
  values inline** (e.g. `k1:52% k2:88%`), five coverage chips, source with
  `sourceRunId` tooltip.
- Unknown slug renders the shell with "no runs for this model on this benchmark"
  plus the slice's run count, so a typo is distinguishable from an empty bench.

### Chart slots — implementation notes (updates §6)

- **Pass@k**: implemented (`chart=passk`). Series = configuration; frontier members
  emphasized. Because Aider ingest delivers 69 series, the slot shows the top 10
  (frontier first, then best pass@k) and states `N hidden` in the header — no silent
  truncation, no 69-line hairball.
- **Effort**: implemented (`chart=effort`). One line per model+harness pair with ≥2
  distinct effort presets (X ordinal low→…→max via `effortRank`); 4 qualifying
  series on live Aider data (e.g. gpt-5 · Aider at low/medium/high).
- **Pareto** remains the default slot; `?chart=` is omitted for it.

## 9b. Compare matrix (`/compare`) — Phase 3

Side-by-side matrix for 2–8 configurations, pinned to **one benchmark version**
(`?benchmark=`, default TB 4.0). Selection via `?ids=` (run ids, exact) and/or
`?slugs=` (model slugs → every run of that model on the slice, solve desc), combined,
deduped, capped at 8 (`selectCompareRuns` in `src/compare.ts`, unit-tested). The
same-benchmark guarantee is structural: the read-only `getCompareData` server function
queries one benchmark version, so pins from another board cannot resolve — they are
reported in a "Not on …" note instead of silently mixing. Fewer than two resolved rows
renders instructions; >8 renders a truncation note.

- Matrix columns: status badge (bench-wide KNEE/FRONTIER/DOMINATED — matches the
  Explorer), configuration (model → `/models/$slug`, harness+version, effort), solve
  rate with n/n, $/task, $/resolved, pass@k inline, tokens (in+out), p50, coverage
  chips, source with `sourceRunId` tooltip. Missing telemetry renders "—" with a
  tooltip, never 0. Best value per numeric column is bolded in emerald.
- Entry points ("pins"): Explorer multi-pin — the `pinned` search param is now a
  comma-separated set (click rows/points to toggle, capped at 8, `Pinned (N)` chip in
  the chart header) — with a "Compare pins (N)" link beside the slot tabs; Finder's
  "Compare best + alternatives →"; model page's "Compare these N runs →".

## 10. Browser QA log (Phase 2)

Environment: `npx wrangler dev --port 8787` (local D1: TB 4.0 + SWE-bench Verified
seed + Aider Polyglot ingest), ZCode in-app browser, viewport 1600×1000. Production
`pareto.jubairjashim1975.workers.dev` currently serves a build **without** the Phase 2
routes (`/finder`, `/models/*` return an app shell without route content), so per the
brief this QA ran locally; the patch needs deploy.

| # | Check | Result |
|---|---|---|
| 1 | `/finder?maxCost=50` TB seed → GLM-5.3 best fit, Sol+Terra alternatives, 5 over-budget in ledger | PASS |
| 2 | Objective switch → min-$/resolved → GPT-5.6 Luna best ($27.27/resolved) | PASS |
| 3 | $33 cap → Terra best fit; Sol/GBM over budget; 3 eligible | PASS |
| 4 | Search-param round-trip incl. `maxCost` after interactions | PASS (after fix, see #9) |
| 5 | `?chart=passk` on Aider → ladder plots 10 series (59 hidden noted), k=1→2 cumulative solve | PASS |
| 6 | `?chart=passk` on TB seed → coverage empty state + `EMPTY` tab badge | PASS |
| 7 | `?chart=effort` on Aider → 4 series; on TB → coverage empty state | PASS |
| 8 | `/models/gpt-5` (Aider) → 3 runs, knee/FRONTIER badges, pass@k inline, movement chart; `/models/glm-5-3` (TB) → 1 run 41.8% | PASS |
| 9 | **Defect found & fixed**: TanStack Router parses `?maxCost=33` as a number; `typeof === "string"` guards dropped it on the next navigate. All route validators now coerce numeric params to strings | FIXED |
| 10 | Table row hover → chart point highlight; click row → pin (`?pinned=`, amber ring + row) | PASS |
| 11 | Explorer Pareto slot unchanged on TB (knee GLM-5.3, frontier polyline, quiet dominated) | PASS |
| 12 | `pnpm test --run` | PASS (24+ tests incl. 9 finder tests) |
| 13 | Known limitation (not a defect): chart-point tooltip cannot be exercised via synthetic pointer events in the harness; formatter verified by code review, wiring unchanged from Phase 1 | NOTE |

### Phase 3 QA (same environment; production still lacks Phase 2 routes)

| # | Check | Result |
|---|---|---|
| 14 | Explorer multi-pin: two row clicks → `pinned=<id>,<id>` in URL, `Pinned (2)` chip, amber rings on both points and rows | PASS |
| 15 | "Compare pins (2)" → `/compare?ids=…&benchmark=…` matrix with KNEE/FRONTIER/DOMINATED badges, best-per-column bold, "—" for missing pass@k/tokens | PASS |
| 16 | Compare reload round-trip (URL re-fetch restores the same matrix) | PASS |
| 17 | Unknown/foreign pin (`?ids=bogus-id,tb4`) → "Not on Terminal-Bench 4.0: ids: bogus-id" + "pin at least two" instructions, no silent drop | PASS |
| 18 | Resources slot on TB seed → both groups render (USD/task + Wall-clock), baseline GPT-5.6 Luna 1.0× dashed line, "tokens group suppressed" note (seed has no token counts) | PASS |
| 19 | Resources slot on Aider (69 rows) → USD-only group, both suppression notes, "43 not drawn (cap 8)", baseline gpt-4o-mini ($0.0014/task) | PASS |
| 20 | Finder "Compare best + alternatives →" → 3-row matrix; model page "Compare these 3 runs →" (Aider gpt-5) → 3-row matrix on Aider | PASS |
| 21 | `pnpm test --run` | PASS (38 tests incl. 13 new compare/resources tests) |
| 22 | Dev-server asset gotcha (not an app defect): `wrangler dev` must be restarted after `pnpm build` — its static-asset manifest is startup-time; stale manifests 404 new hashed assets | NOTE |

## 7. Typography, chrome & the light visual world (Phase 11)

**Physical scene: a bright desk — paper, a green pencil on a scatter — not a SOC cave.**
Light is the product; dark is an operator toggle. First paint is light before hydration
(`class="light"` server-rendered; the boot script flips to dark only for a stored
`dark`/system-dark preference; default `'light'`, in lockstep with
`DEFAULT_THEME_PREF` in `src/theme.ts`).

- **Tokens** (CSS vars in `app.css`; light on `:root`, dark overrides under `html.dark`):
  ground `#F7F5F0`, surface `#FFFEFB`, ink `#12202A`, muted `#5C6B73`, line `#E5DFD2`,
  accent (frontier/primary) `#0F9F6E`, knee `#1D4ED8`, warn (over-budget only) `#C2410C`.
  Domain fields: coding green / general blue / math amber / science violet — flat
  same-hue tints on surface, contained, not rainbow chrome. The old zinc scale maps
  onto the paper world in light mode (so operator pages re-theme wholesale) — this is a
  hue shift, **not** a zinc luminance invert; no zinc-on-zinc, no default `bg-zinc-950`.
- **Type:** body & display **Source Sans 3** (variable, self-hosted via @fontsource);
  figures/labels **IBM Plex Mono** (400/500/600) — numbers and code-ish chips only.
  No Inter/IBM Plex Sans/Space Grotesk/DM Sans as display. Sizes: domain titles
  ≥ 28px, Pick answer model name ≥ 26px, tables ≥ 13px comfortable (13px body base).
- **Charts** init with the light palette from the first paint and re-init on theme
  flips (`useThemeTick` in every chart component); tooltip/knee-label/point-border
  colors are palette-aware. A **skeleton** (faint grid + "loading chart…") occupies
  the chart box until the first `setOption` lands — the app never paints an empty
  white plot while the client-only ECharts chunk loads.
- Cards: `bg-surface` on ground, 1px `line` borders, soft radii (rounded-lg on Pick
  cards, sharp 4px retained on operator tables); shadows only as quiet hover depth.
- Icon set: lucide-react only. No emoji in UI chrome. Favicon: light ground + green
  frontier polyline + blue knee dot.
- Product invariants unchanged: one bench per scatter, dual cost honesty, coverage
  flags (missing data omitted, never zeroed).

### Phase 4 QA — run dossiers, new-bench slices, ingest health

Surfaces: `/runs/$id` dossier; composition-aware banner; ingest-health strip;
dossier nav (table model links, chart shift+click, Finder/model-page links).
Deployed as `f0794b7` → production version `9c086423`; QA below ran on
production unless noted. Actuals differ from the brief's snapshot: the Harbor TB2
slice holds **24** runs at QA time (18 plotted cost-bearing at first check; brief
said 18) and SWE-bench Verified holds **184** rows in the Explorer payload
(180 SWE-bench Experiments + 4 Seed Compiled; earlier SSR snapshot showed
180+8 — KV TTL lag). Isolation holds either way: every query is per
benchmark version, so cross-bench mixing is structurally impossible.

| # | Check (production) | Result |
|---|---|---|
| 23 | TB 4.0 default: knee still GLM-5.3 (Claude Code · max · $40.91/task), seed banner with "10 compiled" | PASS |
| 24 | TB 2.0 slice: 18 visible runs, all `Harbor / Terminal-Bench Leaderboard`, knee GPT-6 Astra; **official-source banner** ("18 runs ingested from official leaderboards") replaces the seed banner; no seed rows | PASS |
| 25 | SWE-bench Verified slice: 184 visible (experiments + seed-compiled, same bench version), seed banner + "compiled/official" counts; scatter shows only 4/184 (cost-bearing rows only — coverage rule keeps it readable); knee recomputed (GPT-5.6 Sol $2.2/task); no Aider/TB4 rows | PASS |
| 26 | `/runs/$id` production: real id → 200, bogus id → 404 (rendered not-found card) | PASS |
| 27 | Dossier content (Harbor run): reported $49.50/task **primary**, restated $465/task as separate coverage-gated number with "+839% vs reported", pass@k inline (k2/k3/k4), p50 2796.3s, tokens, 5 coverage chips, official source attribution with sourceRunId | PASS |
| 28 | Dossier → "Open on the Explorer board →" returns to the same bench with pins preserved; "Compare pins" appears only with ≥2 pins | PASS |
| 29 | Ingest-health strip on production: "INGEST last job: completed" from `/api/ingest/health` (Agy endpoint live); local/404 deployments get the honest "not available … needs Agy deploy" empty state (verified locally pre-deploy) | PASS |
| 30 | Restated-cost honesty: Aider rows locally (no normalized price) show "not restated" dimmed — never substituted for reported | PASS |
| 31 | Same-bench deep links: dossier derives its benchmark from the run itself; foreign pins on `/compare` still land in the "Not on …" note | PASS |
| 32 | Defect fixed this phase: `/runs/$id` loader read `search` (not a loader arg) → 500 on production pre-fix; now `loaderDeps` | FIXED |
| 33 | `pnpm test --run` | PASS (53 tests incl. 6 health-parser tests) |

### Phase 5–6 close-out QA (production `a6553260`+, 2026-09-06)

Shipped: Today-honesty UI fixes, Finder third intent (`cheapest-at-floor` + `minSolve`),
costBasis round-trip on `/compare` + `/finder`, README/CONTRIBUTING/OG surfaces,
Compare in nav, health-strip cost-coverage counts. DeepSWE went live mid-QA
(Agy ingest) and was QA'd as a first-class slice.

| # | Check (production unless noted) | Result |
|---|---|---|
| 34 | Today honesty, explorer: `?costBasis=today` on DeepSWE → 45/70 plotted (restated only), knee recomputed (GPT-5.6 Luna vs deepseek-v4-pro on Reported — the basis demonstrably moves the math), table header "$/TASK (TODAY)", unrestated rows show "—" | PASS |
| 35 | Today honesty, TB seed: 0 restated rows → all 10 cost coords null → scatter suppressed with coverage empty state; no reported fallback | PASS |
| 36 | Tooltip defect fixed: missing price renders "— (not restated)", never `$0` (`shown ?? 0` removed) | FIXED |
| 37 | `costBasis` round-trips on `/compare` (matrix note "today basis — runs without restated pricing show —", basis-aware $/resolved) and `/finder` (server filters on normalized-only; rail note basis-aware); Explorer "Compare pins" carries the basis | PASS |
| 38 | Methodology: "Today falls back to Reported" sentence removed; replaced with the omission rule | PASS |
| 39 | Finder `cheapest-at-floor` + `minSolve=50`, cap $2 on DeepSWE: best fit deepseek-v4-flash (53.3%, $0.10/task), ledger excludes below-floor and over-budget runs with reasons; real `sourceRunId` + dossier links; URL carries `objective=cheapest-at-floor&minSolve=50` | PASS |
| 40 | Launch surfaces: README.md, CONTRIBUTING.md (SourceAdapter contract), `og:title/og:image/twitter:card` live on every route, `/og.svg` 200, nav = Explorer · Finder · Compare · Methodology | PASS |
| 41 | Health strip: production shows "last job: completed · cost coverage: 170 reported / 77 restated / 351 runs" (counts parsed from Agy's payload; endpoint had no literal unmatched field) | PASS |
| 42 | DeepSWE slice: first-class `?benchmark=01J8BV000000000000DEEPSWE11`, 70→78 runs (ingest actively landing during QA), official banner, 7-frontier knee deepseek-v4-pro, dossiers + finder work on it; isolated from TB/Aider/SWE by per-version query | PASS (live) |
| 43 | DeepSWE selector visibility: initially missing due to the 24h KV `catalog:benchmark_options` cache (fell back to TB on a direct URL); self-healed when the catalog refreshed — KV catalog TTL vs fresh benches is Agy-lane, noted | NOTE |
| 44 | Keyboard: filter rail (selects/checkboxes/radios/inputs/buttons) and table model links are natively tabbable and Enter-activatable; every datum is reachable without a pointer (chart hover is the only pointer-only affordance, and the table carries the same data) | PASS |
| 45 | Compare same-bench re-check on new deploy; dossier 200/404 re-check | PASS |
| 46 | `pnpm test --run` | PASS (67 tests incl. floor-intent + health-count additions) |

### Phase 7 — launch polish QA (production `7ccf9f64`, 2026-09-07)

Shipped: `public/og.png` (1200×630, rendered from og.svg via rsvg-convert — frontier
polyline + knee on the dark board), og:image/twitter:image repointed to the PNG with
explicit dimensions, og/twitter descriptions now name DeepSWE alongside Terminal-Bench,
Harbor, Aider, and SWE-bench, README live-board badges, Compare added to home nav.

| # | Check | Result |
|---|---|---|
| 47 | `/og.png` production: 200, image/png, 32 KB, 1200×630; og:image and twitter:image point at it (SVG kept in repo) | PASS |
| 48 | Meta copy names DeepSWE alongside TB / Harbor / Aider / SWE in og:description and twitter:description; no LiveCodeBench/FrontierSWE claims | PASS |
| 49 | README live-board badge (shields) + Today-basis badge at top, linking to the board and the Today view | PASS (local; see #51) |
| 50 | GitHub repo page (github.com/zubalr/pareto): LICENSE Apache-2.0 visible, README renders with the live URL link, CONTRIBUTING.md listed | PASS |
| 51 | GitHub README badge: Agy pushed `f73e039` — "Live board" and "Today basis" badges render on the repo page, both linking to the board (Today badge → `?costBasis=today`); homepage link present in About; Apache-2.0 visible | PASS (resolved 2026-09-07) |
| 52 | DeepSWE in benchmark selector on production: listed and `[selected]` on its canonical URL — no stale-TB fallback (an earlier read of "fallback" was a regex misread of `benchmarkOptions[0]`) | PASS |
| 53 | Finder cheapest-at-floor + Today-honesty re-verified after meta deploy (DeepSWE floor: deepseek-v4-flash 53.3% @ $0.10; Today: 45/70 restated-only, knee GPT-5.6 Luna) | PASS |
| 54 | `pnpm test --run` | PASS (67) |

### Phase 7 confirm pass (2026-09-07, production `7ccf9f64` + push confirmed)

| # | Check | Result |
|---|---|---|
| 55 | GitHub launch render re-check: badges live (see #51), repo About carries the homepage link and topics, `edf8df9` tests-only Actions workflow present and untouched | PASS |
| 56 | `public/robots.txt` added (allow `/`, no sitemap — no marketing pages to index) | PASS |
| 57 | Production re-probe after confirm deploy (`29cc4f97`): `/og.png` + `/robots.txt` 200, DeepSWE selector option present, floor finder best fit deepseek-v4-flash, Today payload keeps unrestated runs at `cost:null` (8 null / 74 plotted as Agy's restatement cron covers more rows — no reported fallback), Compare nav present | PASS |

### Phase 8 — first-impression QA (production `46996a19`, 2026-09-07)

Shipped: PHASE badge removed (wordmark "Pareto"), tightened header; type/contrast
sweep (labels ≥ 11px, body/table ≥ 12px, primary numbers brightened, axis labels
zinc-400); filter rail rebuilt as search + chip pattern (search box per section,
selected options as removable emerald chips, `accent-emerald` checkboxes with focus
rings, taller lists so frontier names are never clipped); `effortMatch=all|max|xhigh`
search param applied server-side **before** frontier math and included in the KV
canonical key (`:em=`, keys.ts) so matched boards cache separately; Finder honors the
same param; few-cost notice on the scatter when < 8 plotted ("the configurations table
below is the primary view"); benchmark selector labels deduped ("Terminal-Bench 2.0 ·
66 tasks", "DeepSWE 1.1 · 113 tasks" — no doubled version).

| # | Check (production) | Result |
|---|---|---|
| 58 | PHASE 1.5 badge gone from chrome; wordmark "Pareto"; header tightened | PASS |
| 59 | Type/contrast: rail labels 11px, list rows and table body 12px, primary numbers zinc-100/200, axis labels brightened; checked boxes visibly filled (accent-emerald) with chips for selected options | PASS |
| 60 | DeepSWE model list: search "astra" narrows to GPT-6 Astra immediately; checking it adds a removable chip and round-trips `models=…` in the URL — no clipping/hunting | PASS |
| 61 | `effortMatch` round-trip: MAX on DeepSWE → `effortMatch=max` in URL, board narrows (Astra+max → 1 visible), server filter verified in payload (only `max` runs; `xhigh` variant only `xhigh`) | PASS |
| 62 | KV key: `:em=` added to the canonical key so matched boards cache separately; cache-key tests updated for the new format + distinctness test | PASS |
| 63 | Effort chart honesty: TB2 renders 1 series because only Astra·Codex has ≥2 effort points in D1 — the chart plots **every** qualifying group (4 series on Aider); single series reflects data, not a plotting bug | PASS (data-dependent) |
| 64 | Selector labels deduped: "Terminal-Bench 2.0 · 66 tasks", "DeepSWE 1.1 · 113 tasks" — "2.0 2.0" cannot appear | PASS |
| 65 | SWE-bench Verified: 4/184 plotted → few-cost notice fires naming the table as the primary view; banner keeps "compiled" count | PASS |
| 66 | Seed/official banners: TB seed still labeled compiled; DeepSWE/TB2 show official-source banner | PASS |
| 67 | Keyboard: rail search boxes, checkboxes, segmented buttons, and table model links are natively tabbable/Enter-activatable (verified via DOM roles); chart remains the only pointer-affordance and duplicates table data | PASS |
| 68 | Default slice: at QA time (`46996a19`) `/` still landed on TB 4.0 seed — DeepSWE fully reachable via `?benchmark=01J8BV000000000000DEEPSWE11` (listed in the selector). Agy's `7c08e52` subsequently landed the DeepSWE default + canonical model identity pass; the switch goes live on their next deploy | RESOLVED upstream |
| 69 | `pnpm test --run` | PASS (70 tests incl. effortMatch key-distinctness + cheapest-at-floor) |

### Phase 9 — volume pass QA (production `bdbecf64`/`665aaa21`, 2026-09-07)

Shipped: methodology rewrite (DeepSWE default story, real worked run id, official-vs-seed
provenance, non-claims), scatter `colorBy=harness|effort|none` (default harness) with
categorical legend, table Effort column + tiered default sort (knee → frontier → solve
desc), model-page cross-bench index (every bench a slug appears on, each linking to its
own board) + effort curve when ≥2 presets, Finder `effortMatch` chip, mobile filter
drawers on Explorer and Finder (< lg), README default-board update, robots.txt.
**Defect found & fixed mid-phase: the colorBy legend referenced effect-scoped maps →
`ReferenceError: categoryKeys is not defined` killed Explorer SSR entirely (empty first
paint, client-only render). Category maps moved to component scope (`useMemo`); a
shadowed `isKnee` boolean (would have thrown `isKnee is not a function` in the chart)
removed. Production SSR re-verified after deploy.**

| # | Check (production) | Result |
|---|---|---|
| 70 | Methodology: default story is DeepSWE (knee DeepSeek V4 Pro · $0.24/task · 62.8%); worked Finder example cites real run id `01J8RUNDS008CD10CMINISWEAG`; official-vs-seed provenance named (Harbor/Aider/SWE official, TB4 archive compiled); non-claims added (not an independent eval lab, not an AA index) | PASS |
| 71 | `colorBy=harness` default: categorical legend in chart header (mini-SWE-agent hue visible), dominated points stay quiet, knee cyan + frontier polyline unchanged; `colorBy=effort`/`none` round-trip | PASS |
| 72 | Table: Effort column added (sortable), harness·effort no longer crammed, default order knee → frontier → solve desc | PASS |
| 73 | `/models/$slug` cross-bench index: renders on production after two defects fixed — (a) `data.index.entries` accidentally read `Array.prototype.entries` (length 1) instead of the array; (b) the model page defaulted to TB 4.0 while production defaults to DeepSWE, landing `/models/gpt-6-astra` on "Unknown model". Now: DeepSWE default mirrored server-side, "Appears on 2 boards" (DeepSWE + TB2; Agy's canonical model-identity pass re-mapped some Astra rows mid-QA) with per-board links; effort curve renders when ≥2 presets | FIXED/PASS |
| 74 | Finder: `effortMatch` chip in banner clears on click; typography at the Phase-8 floor | PASS |
| 75 | Mobile 375px: Explorer has no page-wide horizontal scroll (scrollWidth ≤ clientWidth); "Filters" button opens the rail as a drawer with all sections; Finder gets the same drawer ("Inputs") | PASS |
| 76 | Explorer SSR: restored after the colorBy scope fix — `<aside>`, Match effort, search box, and color select all server-rendered | FIXED |
| 77 | DeepSWE default on `/` (Agy's `7c08e52` live); Harbor TB2 still 18 rows — nothing faked | PASS |
| 78 | README: default board = DeepSWE called out in intro + routes table | PASS |
| 79 | `pnpm test --run` | PASS (71) |

### Phase 9 addendum (2026-09-07, production `c2d76076`)

| # | Check | Result |
|---|---|---|
| 80 | SSR regression hunt: the Explorer colorBy legend + the model cross-bench section both silently suspended SSR (`<!--$!-->` empty main). Explorer fixed (component-scope `useMemo` for category maps); model page fixed (single server fn per loader — the two-parallel-`createServerFn` pattern left one promise unsettled on Workers; index query folded into `getModelData`) | FIXED |
| 81 | Model page defaults mirror the Explorer default (DeepSWE first, TB 4.0 archive second) — "Unknown model" on the default bench can no longer happen for a valid slug | FIXED |
| 82 | Selector during Agy's data churn: TB20 row temporarily surfaced as "Terminal-Bench 4.0" (Agy renamed/migrated mid-QA); `benchLabel` cannot disambiguate a data-level rename — Agy lane | NOTE |

### Phase 10 — craft pass QA (production `ddbdd1ce`+, 2026-09-07)

Shipped: theme system (`?theme=` + localStorage + header toggle; light token
inversion via Tailwind v4 `--color-zinc-*` overrides with darkened accents;
ECharts init theme + palettes follow; reduced-motion kills chart animation),
a11y (skip link to `#main`, drawer focus-trap + Esc, `/` focuses model search,
focus rings on chips/tabs/buttons), share/export (Copy view URL, Export CSV of
the visible slice), density param (`density=compact|comfortable`), table
pagination (50/page), frontier-first model filter ordering, Compare
`effortMatch` + sticky config column, louder Finder best-fit card, collapsible
"How to read this" onboarding (dismiss-once in localStorage), per-route titles,
relative last-ingest time.

| # | Check (production) | Result |
|---|---|---|
| 83 | Theme toggle: light/dark/system segmented in header; light inverts surfaces + darkens accents (no grey-on-white); ECharts re-inits with the light palette; boot script applies pre-paint from `?theme=` or localStorage | PASS |
| 84 | Theme round-trip: `saveTheme` → `getThemePref` → `resolveTheme("system")` follows OS (unit-tested with stubbed storage/matchMedia) | PASS |
| 85 | Skip link to `#main` (visible on focus); drawer focus-trap + Esc close on Explorer and Finder | PASS |
| 86 | `/` focuses the model search (ignores typing contexts); visible focus rings on chips, tabs, density select, table buttons | PASS |
| 87 | Copy view URL: copies the current search string with button-text confirm | PASS |
| 88 | Export CSV: header row (model, harness, effort, solve, $ reported, $ today, 5 coverage flags, sourceRunId) — unit-tested incl. quoting + empty-for-missing price; no task text columns | PASS |
| 89 | Density: `density=comfortable` → 13px rows + more padding; compact default; round-trips | PASS |
| 90 | Model filter order: frontier/knee members first, then best solve desc (search preserved) | PASS |
| 91 | Compare: effortMatch honored server-side when navigated with it; sticky config column; type floor | PASS |
| 92 | Finder best-fit card visually louder (larger title/solve, cyan ring) with real `sourceRunId` provenance | PASS |
| 93 | How-to-read collapsible under the chart; dismiss-once persists in localStorage | PASS |
| 94 | Per-route titles (Explorer bench-aware, Finder, Compare, Model, Run, Methodology); relative last-ingest time ("29m ago") from health `startedAt` | PASS |
| 95 | DeepSWE 70-row table paginates (50/page) — no frozen tab; SWE 184-row slice paginates the same | PASS |
| 96 | Reduced motion: chart animation 0 + CSS transitions killed under `prefers-reduced-motion` | PASS |
| 97 | `pnpm test --run` | PASS (81 incl. theme/csv/density/relative-time suites) |

### Phase 11 — Pick + light world QA (production `57607b53` → `179be606`, 2026-09-08)

Shipped: `/` is **Pick** (four domain cards first viewport; coding → live D1 via the
Finder server fn; general/math/science → compiled attributed snapshot with
price-proxy labeling), Explorer moved to `/explore` with legacy `/?benchmark=…`
redirects preserving params, **light is the default theme** (paper ground `#F7F5F0`,
surface `#FFFEFB`, ink `#12202A`, accent `#0F9F6E`, knee `#1D4ED8`, warn `#C2410C`;
zinc utilities remapped to the paper world — a hue shift, not a zinc invert), Source
Sans 3 body + IBM Plex Mono figures (self-hosted fontsource), domain color fields,
boot script default `'light'` shared with `DEFAULT_THEME_PREF`, charts re-init on
theme flips and render a skeleton until first `setOption` (never an empty painted
plot), tooltip/knee-label/point-border colors palette-aware, nav = Pick · Explorer ·
Finder · Compare · Methodology, science GPQA sub-intent with saturation banner,
Methodology §5 (Pick: domain map, proxy vs $/task, ceilings, not-AA),
`src/data/compiled-domain-scores.ts` (< 150 KB, sources/licenses/staleness inline),
`src/pick.ts` (one ranker: `selectFinder` + Pick framing), 11 new unit tests.
**Defect found & fixed in QA: the header nav overflowed 375px viewports (435px) —
nav is now horizontally scrollable with shrink-0 links.** Also fixed a pre-existing
latent chart-legend `pal` reference (masked by `??` short-circuit) to
`chartPalette()`. Local-env note: a stale local-KV DeepSWE payload (written before
the local D1 clone) suppressed the board until the key was deleted — KV-first
working as designed, local-only.

| # | Check (production, no `?theme=` unless stated) | Result |
|---|---|---|
| 98 | `/` fresh visit: first paint light (`class="light"`, no stored pref), paper ground + green accent, 28px+ domain titles, four color-field cards — not a zinc invert | PASS |
| 99 | Coding → budget $2 → floor 50%: answer card shows **model GLM-5.3 Flash, effort max, harness mini-SWE-agent, 63.4% (72/113), $0.48/task** from live D1, why-sentence, `sourceRunId` + official badge, dossier / Explorer / Finder links | PASS |
| 100 | Cheaper alternative (DeepSeek V4 Flash 53.3% @ $0.10) and stronger over-budget step (GPT-5.6 Luna 67.2% @ $3.03, warn tone) — both same bench, same effort | PASS |
| 101 | Unit: `pickFromCandidates` on the DeepSWE $2 / 50% slice returns the real run id `01J8RUNDS6314BEDBMINISWEAG` (fixture = real production rows) | PASS |
| 102 | Coding sub-intents: Terminal (Harbor TB 2.0) · Polyglot (Aider 1.0) · GitHub bugs (SWE-bench Verified 1.0) each answer from D1 with their own bench label | PASS |
| 103 | General: Gemini 3.1 Pro Preview 91.2% MMLU-Pro @ $12/M out; red "price proxy, not $/task" always visible; 13 unpriced rows omitted (coverage note), never zeroed; sources & licenses panel | PASS |
| 104 | Math: GPT-5.2 100.0% AIME 2025 (frozen board) @ $14/M proxy with ceiling note; Science: Gemini 3.7 Flash 43.0% SciCode @ $3.75/M | PASS |
| 105 | Science GPQA sub-intent: Grok 4.5 94.9% with "(saturated)" chip + ceiling banner; snapshot citation `kaggle-gpqa-diamond:grok-4-5` | PASS |
| 106 | Proxy rule unit-tested: `costSemantics` coding = $/task (no proxy); general/math/science = $/M out proxy; unpriced snapshot rows excluded by budget filtering, never priced $0 | PASS |
| 107 | Legacy URL: `/?benchmark=…&effortMatch=max` → 307 to `/explore?…` with params preserved; board renders DeepSWE max slice (14 visible, knee GLM-5.3 Flash) | PASS |
| 108 | `/explore` light chart from first init (green frontier, blue knee chip, warm grid); skeleton until option set — no empty white plot; Effort tab (EMPTY badge) shows the coverage empty state, not a blank canvas | PASS |
| 109 | Theme: `?theme=light` + Light button agree (aria-pressed=true, light class); `?theme=dark` persists; dark re-themes charts (toggle re-init) | PASS |
| 110 | Mobile 375px: no horizontal scroll (nav overflow fixed), domain cards stack, answer card renders before the controls | PASS (after fix) |
| 111 | Methodology §5 Pick (domain→bench map table, proxy vs $/task, saturation, not-AA), DESIGN.md §Pick + §7 rewrite, README (home is Pick, light default), docs/sources.md §8 snapshot table | PASS |
| 112 | `pnpm test --run` | PASS (92 incl. 11 new pick/theme tests) |

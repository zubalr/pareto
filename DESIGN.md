# DESIGN.md — Pareto Explorer, Phase 1.5

Design record for the Explorer board: layout, chart encodings, color/opacity rules,
empty & coverage states, and the specification for future charts. Written so the next
session (human or agent) can reconstruct every visual decision without re-deriving it.

**Status: needs deploy.** Phase 1.5 UI changes are committed as a local patch.
Deployment is blocked upstream on Cloudflare account auth (see `BLOCKED.md` from the
Phase 1 cost pass) — do not ship from a preview account. When the human completes
`wrangler login` on the paid account, `pnpm deploy` publishes this patch unchanged.

---

## 1. Layout

Operate-mode dashboard, dark-first (`#09090b` base, zinc scale). Reference points:
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
- URL is the source of truth. Every filter, the pin, and the cost basis live in search
  params (`?benchmark=&models=&harnesses=&efforts=&costBasis=&pinned=`); filtered URLs
  round-trip through `validateSearch` (arrays coerce from single values).
- Banner stays: numbers are compiled/seed, not an official leaderboard.

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
- **Pass@k slot**: no seed row has `has_pass_at_k = 1`, so the slot renders the quiet
  empty state ("no pass@k telemetry in this slice; chart suppressed rather than
  fabricated · spec: DESIGN.md §6") — see §6. The day `hasPassAtK` data lands, the slot
  renders the ladder instead. No lying chart, ever.

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
(missing telemetry removes a point from that encoding, never zero-fills), dark zinc
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

### 6.3 Resource multipliers vs baseline
- **Trigger**: ≥2 configurations sharing model+harness+benchmark differing only in
  resource knobs (effort, trials, time budget), plus a chosen baseline configuration.
- **Encoding**: X = resource multiplier vs baseline (tokens or cost ratio, log),
  Y = solve-rate *delta* in points vs baseline (can be negative). Baseline at (1, 0)
  marked; points right-and-up = resource well spent; right-and-down = wasted spend.
- **Example**: baseline GLM-5.3 · max = (1.0×, +0); GLM-5.3 · max ×2-trial voting =
  (2.1×, +3.2 pts) — worth it only if the viewer prices 3.2 points above 1.1× cost.

## 7. Typography & chrome

- Body/mono mix: labels and numbers in monospace (`font-mono`), prose in sans. Sizes
  cluster at 10–12px; strip labels 9px uppercase with wide tracking. Dense but never
  under 9px.
- Cards: `bg-zinc-950` on `#09090b`, 1px `zinc-800/80` borders, 4px radii (sharp,
  instrument-like; no big marketing shadows).
- Icon set: lucide-react only (`Zap` knee, `Pin` pinned, `Boxes`/`Cpu`/
  `SquareTerminal`/`Gauge`/`CircleDollarSign`/`RotateCcw` in the rail). No emoji in UI
  chrome (the Phase 1 `⚡` glyph was replaced by the `Zap` icon; the favicon is now an
  inline SVG of the frontier polyline + knee dot).

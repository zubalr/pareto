import React, { useEffect, useRef } from "react";
import type { ExplorerRun } from "../server/functions";
import { parsePassAtK, effortRank } from "../finder";
import { buildResourceCompare } from "../resources";

// Shared chrome for the Pass@k and Effort chart slots (DESIGN.md §6).
// Coverage rule: a slot with no eligible telemetry renders the empty state —
// it never fabricates points or plots zeros.

export function SlotEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="relative w-full h-[440px] bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <SlotHeader title={title} note="coverage" />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <span className="text-zinc-400 text-xs font-mono">{message}</span>
        <span className="text-zinc-600 text-[10px]">
          Coverage rule: a slot without telemetry stays empty — missing data is never plotted as a
          value.
        </span>
      </div>
    </div>
  );
}

function SlotHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-1 pb-2 border-b border-zinc-800/40 text-[11px]">
      <span className="text-zinc-300 font-semibold uppercase tracking-wider">{title}</span>
      <span className="text-[10px] text-zinc-500 font-mono">{note}</span>
    </div>
  );
}

export function useEChart(
  buildOption: (echarts: any) => object,
  deps: React.DependencyList
) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (typeof window === "undefined" || !chartRef.current) return;
      const echarts = await import("echarts");
      if (!isMounted || !chartRef.current) return;
      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current, "dark", { renderer: "svg" });
      }
      chartInstanceRef.current.setOption(buildOption(echarts), true);
    }
    init();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  return chartRef;
}

const SLOT_COLORS = ["#10b981", "#06b6d4", "#a78bfa", "#f59e0b", "#f472b6", "#60a5fa"];

function tooltipFlags(r: ExplorerRun): string {
  const flag = (ok: boolean, label: string) =>
    `<span style="color:${ok ? "#d4d4d8" : "#3f3f46"};">${label}${ok ? " ✓" : " –"}</span>`;
  return `<div style="display:flex; gap:6px; font-size:9px; margin-top:3px;">${flag(
    r.hasTokens,
    "TOK"
  )}${flag(r.hasCost, "USD")}${flag(r.hasLatency, "LAT")}${flag(
    r.hasPassAtK,
    "P@K"
  )}${flag(r.hasCi, "CI")}</div>`;
}

const MAX_PASSK_SERIES = 10;

export function PassAtKChart({ runs }: { runs: ExplorerRun[] }) {
  const allSeries = runs
    .filter((r) => r.hasPassAtK)
    .map((r) => ({
      run: r,
      points: parsePassAtK(r.passAtK),
      maxPct: Math.max(...parsePassAtK(r.passAtK).map((p) => p.percent), 0),
    }))
    .filter((s) => s.points.length > 0);
  // Frontier members first, then by best pass@k — 69-series Aider ingest must stay readable.
  allSeries.sort((a, b) => {
    if (a.run.isFrontier !== b.run.isFrontier) return a.run.isFrontier ? -1 : 1;
    return b.maxPct - a.maxPct;
  });
  const seriesData = allSeries.slice(0, MAX_PASSK_SERIES);
  const hiddenCount = Math.max(0, allSeries.length - seriesData.length);

  const chartRef = useEChart(
    () => {
      const kValues = Array.from(
        new Set(seriesData.flatMap((s) => s.points.map((p) => p.k)))
      ).sort((a, b) => a - b);

      const lines = seriesData.map((s, i) => {
        const byK = new Map(s.points.map((p) => [p.k, p.percent]));
        const label = `${s.run.modelDisplayName} · ${s.run.harnessName} · ${s.run.effortPresetSlug}`;
        return {
          name: label,
          type: "line",
          data: kValues.map((k) => byK.has(k) ? byK.get(k) : null),
          showSymbol: true,
          symbolSize: s.run.isFrontier ? 8 : 6,
          lineStyle: {
            width: s.run.isFrontier ? 2 : 1.5,
            opacity: s.run.isFrontier ? 1 : 0.55,
          },
          itemStyle: { color: SLOT_COLORS[i % SLOT_COLORS.length] },
          emphasis: { scale: 1.4 },
          connectNulls: false,
        };
      });

      return {
        backgroundColor: "transparent",
        animationDuration: 200,
        grid: { top: 36, right: 28, bottom: 56, left: 56 },
        legend: {
          bottom: 0,
          left: "center",
          textStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          itemWidth: 14,
          itemHeight: 8,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "#101013",
          borderColor: "#3f3f46",
          borderWidth: 1,
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const s = seriesData[params.seriesIndex];
            if (!s) return "";
            const pct = Number(params.value);
            return `
              <div style="min-width: 200px; line-height: 1.55;">
                <div style="font-weight:bold; color:#fff;">${s.run.modelDisplayName}</div>
                <div style="color:#a1a1aa; font-size:10px; margin-bottom:4px;">
                  ${s.run.providerName} · ${s.run.harnessName} · ${s.run.effortPresetSlug}
                </div>
                <div>pass@${kValues[params.dataIndex]}: <strong style="color:#fff;">${Number.isFinite(pct) ? pct.toFixed(1) : "—"}%</strong></div>
                <div style="color:#71717a; font-size:9px;">solve(n=1): ${s.run.solveRate.toFixed(1)}% · ${s.run.nSolved}/${s.run.nTotal} tasks</div>
                ${tooltipFlags(s.run)}
                <div style="font-size:9px; color:#52525b; margin-top:3px;">source: ${s.run.sourceName}</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "category",
          name: "k (attempts)",
          nameLocation: "middle",
          nameGap: 28,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          data: kValues.map((k) => String(k)),
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10 },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: 100,
          name: "Cumulative solve (%)",
          nameLocation: "middle",
          nameGap: 42,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: "#18181b", type: "dashed" } },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        series: lines,
      };
    },
    [seriesData]
  );

  if (seriesData.length === 0) {
    return (
      <SlotEmpty
        title="Pass@k ladder"
        message="No pass@k telemetry in this slice — series appear when ingested rows carry pass_at_k (e.g. Aider k=1,2)."
      />
    );
  }

  return (
    <div className="relative w-full h-[440px] bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <SlotHeader
        title="Pass@k ladder"
        note={`${seriesData.length} shown${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""} · x: attempts k · y: cumulative solve %`}
      />
      <div ref={chartRef} className="flex-1 w-full min-h-[300px]" />
    </div>
  );
}

export function EffortChart({ runs }: { runs: ExplorerRun[] }) {
  // Group by model+harness; a group qualifies only with >= 2 distinct effort presets.
  const groups = new Map<
    string,
    { label: string; provider: string; sourceName: string; byEffort: Map<string, ExplorerRun> }
  >();
  for (const r of runs) {
    const key = `${r.modelSlug}|${r.harnessId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        label: `${r.modelDisplayName} · ${r.harnessName}`,
        provider: r.providerName,
        sourceName: r.sourceName,
        byEffort: new Map(),
      });
    }
    groups.get(key)!.byEffort.set(r.effortPresetSlug, r);
  }
  const qualifying = Array.from(groups.values()).filter((g) => g.byEffort.size >= 2);

  const chartRef = useEChart(
    () => {
      const effortAxis = Array.from(
        new Set(qualifying.flatMap((g) => Array.from(g.byEffort.keys())))
      ).sort((a, b) => effortRank(a) - effortRank(b) || a.localeCompare(b));

      const lines = qualifying.map((g, i) => ({
        name: g.label,
        type: "line",
        data: effortAxis.map((e) => {
          const run = g.byEffort.get(e);
          return run ? run.solveRate : null;
        }),
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2, opacity: 0.9 },
        itemStyle: { color: SLOT_COLORS[i % SLOT_COLORS.length] },
        connectNulls: false,
        emphasis: { scale: 1.4 },
      }));

      return {
        backgroundColor: "transparent",
        animationDuration: 200,
        grid: { top: 36, right: 28, bottom: 56, left: 56 },
        legend: {
          bottom: 0,
          left: "center",
          textStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          itemWidth: 14,
          itemHeight: 8,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "#101013",
          borderColor: "#3f3f46",
          borderWidth: 1,
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const g = qualifying[params.seriesIndex];
            const run = g?.byEffort.get(effortAxis[params.dataIndex]);
            if (!g || !run) return "";
            return `
              <div style="min-width: 200px; line-height: 1.55;">
                <div style="font-weight:bold; color:#fff;">${run.modelDisplayName}</div>
                <div style="color:#a1a1aa; font-size:10px; margin-bottom:4px;">
                  ${g.provider} · ${run.harnessName} · effort: ${run.effortPresetSlug}
                </div>
                <div>Solve rate: <strong style="color:#fff;">${run.solveRate.toFixed(1)}%</strong> (${run.nSolved}/${run.nTotal})</div>
                <div>$/task: <strong style="color:#fff;">${run.cost !== null ? `$${run.cost.toFixed(2)}` : "—"}</strong></div>
                ${tooltipFlags(run)}
                <div style="font-size:9px; color:#52525b; margin-top:3px;">source: ${g.sourceName}</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "category",
          name: "Effort preset",
          nameLocation: "middle",
          nameGap: 28,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          data: effortAxis,
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, uppercase: true },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
          type: "value",
          min: 0,
          name: "Solve rate (%)",
          nameLocation: "middle",
          nameGap: 42,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: "#18181b", type: "dashed" } },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        series: lines,
      };
    },
    [qualifying]
  );

  if (qualifying.length === 0) {
    return (
      <SlotEmpty
        title="Effort curve"
        message="No model+harness pair in this slice was evaluated at multiple effort presets — curves appear when such rows exist."
      />
    );
  }

  return (
    <div className="relative w-full h-[440px] bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <SlotHeader
        title="Effort curve"
        note={`${qualifying.length} series · x: effort preset · y: solve %`}
      />
      <div ref={chartRef} className="flex-1 w-full min-h-[300px]" />
    </div>
  );
}

// Resource multipliers vs the cheapest costed configuration (DESIGN.md §6.3,
// revised): grouped bars, x = metric group, bars = configurations, value =
// multiplier vs baseline (baseline = 1.0x). Groups whose baseline telemetry is
// missing are suppressed; configs missing a metric get no bar in that group.
export function ResourceChart({ runs }: { runs: ExplorerRun[] }) {
  const rc = buildResourceCompare(runs);

  const chartRef = useEChart(
    () => {
      const groupDefs: Array<{ key: "usd" | "tokens" | "wallclock"; label: string }> = [
        { key: "usd", label: "USD/task" },
        { key: "tokens", label: "Tokens" },
        { key: "wallclock", label: "Wall-clock" },
      ].filter((g) => rc.groups[g.key]);

      const lines = rc.configs.map((c, i) => ({
        name: `${c.isBaseline ? "★ " : ""}${c.run.modelDisplayName} · ${c.run.harnessName} · ${c.run.effortPresetSlug}`,
        type: "bar" as const,
        data: groupDefs.map((g) => {
          const m = c[g.key];
          return m ? Number(m.mult.toFixed(3)) : null;
        }),
        itemStyle: {
          color: c.isBaseline ? "#10b981" : SLOT_COLORS[(i + 1) % SLOT_COLORS.length],
          opacity: c.isBaseline ? 1 : 0.85,
        },
        barMaxWidth: 22,
        // baseline reference line on the first series
        ...(i === 0
          ? {
              markLine: {
                silent: true,
                symbol: "none",
                data: [{ yAxis: 1 }],
                lineStyle: { color: "#71717a", type: "dashed", width: 1 },
                label: { formatter: "baseline 1.0x", color: "#a1a1aa", fontSize: 9, fontFamily: "monospace", position: "insideEndTop" },
              },
            }
          : {}),
      }));

      return {
        backgroundColor: "transparent",
        animationDuration: 200,
        grid: { top: 36, right: 24, bottom: 64, left: 56 },
        legend: {
          bottom: 0,
          left: "center",
          textStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          itemWidth: 12,
          itemHeight: 8,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "#101013",
          borderColor: "#3f3f46",
          borderWidth: 1,
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const c = rc.configs[params.seriesIndex];
            if (!c) return "";
            const g = groupDefs[params.dataIndex];
            const m = c[g.key];
            const abs =
              g.key === "usd"
                ? `$${(m?.abs ?? 0).toFixed(2)}/task`
                : g.key === "tokens"
                  ? `${(m?.abs ?? 0).toLocaleString()} tokens`
                  : `${(m?.abs ?? 0).toFixed(1)}s p50`;
            return `
              <div style="min-width: 210px; line-height: 1.55;">
                <div style="font-weight:bold; color:#fff;">${c.run.modelDisplayName}${c.isBaseline ? " (baseline)" : ""}</div>
                <div style="color:#a1a1aa; font-size:10px; margin-bottom:4px;">${c.run.harnessName} · ${c.run.effortPresetSlug}</div>
                <div>${g.label}: <strong style="color:#fff;">${m ? m.mult.toFixed(2) + "x" : "—"}</strong> <span style="color:#71717a;">(${abs})</span></div>
                <div style="color:#71717a; font-size:9px;">solve ${c.run.solveRate.toFixed(1)}%</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "category",
          data: groupDefs.map((g) => g.label),
          axisLabel: { color: "#a1a1aa", fontFamily: "monospace", fontSize: 10 },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
          type: "value",
          name: "Multiplier vs baseline",
          nameLocation: "middle",
          nameGap: 42,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, formatter: (v: number) => `${v}x` },
          splitLine: { lineStyle: { color: "#18181b", type: "dashed" } },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        series: lines,
      };
    },
    [rc]
  );

  const valid =
    rc.baseline !== null && rc.configs.length >= 2 && (rc.groups.usd || rc.groups.tokens || rc.groups.wallclock);

  if (!valid) {
    const reason =
      rc.baseline === null
        ? "No configuration in this slice reports cost — no baseline exists."
        : rc.configs.length < 2
          ? "Resource multipliers need at least two costed configurations in the slice."
          : "No resource metrics comparable against the baseline.";
    return (
      <SlotEmpty title="Resource multipliers" message={reason} />
    );
  }

  const hidden = Math.max(0, runs.filter((r) => r.hasCost && r.cost !== null && r.cost > 0).length - rc.configs.length);

  return (
    <div className="relative w-full h-[440px] bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <SlotHeader
        title="Resource multipliers"
        note={`baseline: ${rc.baseline?.modelDisplayName} · ${rc.configs.length} configs${hidden > 0 ? ` · ${hidden} not drawn` : ""}`}
      />
      {rc.notes.length > 0 && (
        <div className="px-2 pt-1.5 text-[9px] text-zinc-500 font-mono flex flex-wrap gap-x-4">
          {rc.notes.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      )}
      <div ref={chartRef} className="flex-1 w-full min-h-[280px]" />
    </div>
  );
}

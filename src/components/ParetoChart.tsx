import React, { useEffect, useRef } from "react";
import { Pin } from "lucide-react";
import type { ExplorerRun } from "../server/functions";
import { effortRank } from "../finder";

// Categorical palette shared with the chart slots (kept local to avoid a cycle).
const SLOT_COLORS = ["#10b981", "#06b6d4", "#a78bfa", "#f59e0b", "#f472b6", "#60a5fa"];

interface ParetoChartProps {
  runs: ExplorerRun[];
  frontier: ExplorerRun[];
  kneePoint: ExplorerRun | null;
  pinnedIds: string[];
  hoveredId: string | null;
  onSelectPin: (id: string | null) => void;
  onHoverPoint: (id: string | null) => void;
  onOpenDossier?: (id: string) => void;
  colorBy?: "harness" | "effort" | "none";
  costBasis: "reported" | "today";
}

// Color tokens (see DESIGN.md §Encodings)
const COLOR = {
  dominated: "#52525b",
  frontier: "#10b981",
  knee: "#06b6d4",
  pin: "#f59e0b",
  grid: "#18181b",
  axis: "#27272a",
  label: "#71717a",
  axisName: "#a1a1aa",
};

function niceCeil(v: number, step: number): number {
  return Math.ceil(v / step) * step;
}

function fmtUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 10) return `$${v.toFixed(0)}`;
  if (v >= 1) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}

export function ParetoChart({
  runs,
  frontier,
  kneePoint,
  pinnedIds,
  hoveredId,
  onSelectPin,
  onHoverPoint,
  onOpenDossier,
  colorBy = "harness",
  costBasis,
}: ParetoChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  // Handlers registered once must read the latest pin, not the init-time one.
  const lastHoveredIndexRef = useRef<number | null>(null);

  // Coverage rule: a run without positive reported cost never gets an X coordinate.
  const validRuns = runs.filter(
    (r) => r.hasCost && r.cost !== null && r.cost !== undefined && r.cost > 0 && !Number.isNaN(r.cost)
  );

  // colorBy: categorical hue per harness or effort preset. Component scope so the
  // SSR'd legend and the effect share one source of truth.
  const categoryKeys = React.useMemo(() => {
    if (colorBy === "effort") {
      return Array.from(new Set(runs.map((r) => r.effortPresetSlug))).sort(
        (a, b) => effortRank(a) - effortRank(b) || a.localeCompare(b)
      );
    }
    if (colorBy === "harness") {
      return Array.from(new Set(runs.map((r) => r.harnessName))).sort();
    }
    return [];
  }, [runs, colorBy]);
  const categoryColor = React.useMemo(
    () => new Map(categoryKeys.map((k, i) => [k, SLOT_COLORS[i % SLOT_COLORS.length]])),
    [categoryKeys]
  );
  const isKneePoint = React.useCallback(
    (r: ExplorerRun) => kneePoint?.id === r.id,
    [kneePoint]
  );

  const emptyMessage =
    runs.length === 0
      ? "No runs match the current filters."
      : validRuns.length === 0
        ? `${runs.length} run(s) visible, none with reported cost — scatter suppressed. Missing cost is never plotted as $0.`
        : null;

  useEffect(() => {
    let isMounted = true;

    async function initChart() {
      if (typeof window === "undefined" || !chartRef.current) return;

      // Client-only dynamic import; never reached during SSR.
      const echarts = await import("echarts");

      if (!isMounted || !chartRef.current) return;

      if (!chartInstanceRef.current) {
        const chart = echarts.init(chartRef.current, "dark", { renderer: "svg" });
        chartInstanceRef.current = chart;

        chart.on("click", (params: any) => {
          if (params.data && params.data.runId) {
            // shift+click opens the run dossier; plain click toggles the
            // multi-pin set (membership logic lives in the parent)
            const native = params.event?.event as MouseEvent | undefined;
            if (native?.shiftKey) {
              onOpenDossier?.(params.data.runId);
              return;
            }
            onSelectPin(params.data.runId);
          }
        });

        chart.on("mouseover", (params: any) => {
          if (params.data && params.data.runId) {
            onHoverPoint(params.data.runId);
          }
        });

        chart.on("mouseout", () => {
          onHoverPoint(null);
        });

        const handleResize = () => {
          chartInstanceRef.current?.resize();
        };
        window.addEventListener("resize", handleResize);
      }

      const chart = chartInstanceRef.current;

      if (validRuns.length === 0) {
        lastHoveredIndexRef.current = null;
        chart.setOption(
          {
            backgroundColor: "transparent",
            title: {
              text: emptyMessage ?? "No data.",
              subtext: runs.length > 0 ? "Clear filters or switch cost basis to restore the scatter." : "",
              left: "center",
              top: "middle",
              textStyle: { color: "#71717a", fontSize: 12, fontFamily: "monospace" },
              subtextStyle: { color: "#52525b", fontSize: 11, fontFamily: "monospace" },
            },
            xAxis: { show: false },
            yAxis: { show: false },
            series: [],
          },
          true
        );
        return;
      }

      const costs = validRuns.map((r) => r.cost as number);
      const minCost = Math.min(...costs);
      const maxCost = Math.max(...costs);
      const maxSolve = Math.max(...validRuns.map((r) => r.solveRate), 10);
      // Dense slices (e.g. 184 SWE-bench rows) quiet the dominated cloud further;
      // frontier math is computed over every run either way — no subsampling.
      const dense = validRuns.length > 60;

      // colorBy: assign a categorical hue per harness or effort preset. Frontier
      // size/polyline and the cyan knee keep their encodings; dominated points
      // stay quiet via opacity. colorBy=none restores the gray-dominated scheme.
      const fillFor = (r: ExplorerRun): string => {
        if (isKneePoint(r)) return COLOR.knee;
        if (colorBy === "none") return r.isFrontier ? COLOR.frontier : COLOR.dominated;
        const key = colorBy === "effort" ? r.effortPresetSlug : r.harnessName;
        return categoryColor.get(key) ?? COLOR.dominated;
      };

      // Log-scale X bounds: half a decade below and ~25% above so edge points breathe.
      const xMin = minCost / 2;
      const xMax = minCost === maxCost ? maxCost * 2 : maxCost * 1.25;
      const yMax = niceCeil(maxSolve * 1.1, 10);

      // Frontier polyline on undominated points only, sorted by cost ascending.
      const sortedFrontier = [...frontier]
        .filter((r) => r.cost !== null && r.cost > 0)
        .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));

      const polylineData = sortedFrontier.map((r) => [r.cost, r.solveRate]);

      const scatterData = validRuns.map((r, i) => {
        const knee = isKneePoint(r);
        const isPinned = pinnedIds.includes(r.id);

        let symbolSize = 7;
        let color = fillFor(r);
        let borderColor = "#18181b";
        let borderWidth = 1;
        let opacity = dense ? 0.3 : 0.45;
        let shadowBlur = 0;
        let shadowColor = "transparent";

        if (r.isFrontier) {
          symbolSize = 11;
          borderColor = "#064e3b";
          borderWidth = 1.5;
          opacity = 1;
          if (colorBy === "none") color = COLOR.frontier;
        }

        if (knee) {
          symbolSize = 16;
          color = COLOR.knee;
          borderColor = "#ffffff";
          borderWidth = 2;
          opacity = 1;
          shadowBlur = 12;
          shadowColor = "rgba(6,182,212,0.5)";
        }

        if (isPinned) {
          symbolSize = Math.max(symbolSize, 14);
          borderColor = COLOR.pin;
          borderWidth = 3;
          opacity = 1;
          shadowBlur = 8;
          shadowColor = "rgba(245,158,11,0.45)";
        }

        return {
          name: r.modelDisplayName,
          value: [r.cost, r.solveRate],
          runId: r.id,
          run: r,
          itemStyle: { color, borderColor, borderWidth, opacity, shadowBlur, shadowColor },
          symbolSize,
          // Hover emphasis applied via dispatchAction so the tooltip is never
          // torn down by a setOption rebuild (see DESIGN.md §2).
          emphasis: {
            scale: 1.4,
            itemStyle: { opacity: 1, borderColor: "#d4d4d8", borderWidth: 2 },
          },
        };
      });

      // Knee callout: model + harness + effort + $/task + solve%.
      const markPointData = kneePoint
        ? [
            {
              name: "Knee Point",
              coord: [kneePoint.cost, kneePoint.solveRate],
              symbol: "circle",
              symbolSize: 1,
              itemStyle: { color: "transparent" },
              label: {
                show: true,
                position: "top",
                distance: 10,
                formatter: [
                  `{title|KNEE — ${kneePoint.modelDisplayName}}`,
                  `{sub|${kneePoint.harnessName} · ${kneePoint.effortPresetSlug} · ${fmtUsd(kneePoint.cost ?? 0)}/task · ${kneePoint.solveRate.toFixed(1)}%}`,
                ].join("\n"),
                rich: {
                  title: {
                    color: "#67e8f9",
                    fontSize: 11,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    backgroundColor: "#083344",
                    padding: [4, 6, 2, 6],
                    borderRadius: [4, 4, 0, 0],
                    borderColor: COLOR.knee,
                    borderWidth: 1,
                  },
                  sub: {
                    color: "#a5f3fc",
                    fontSize: 11,
                    fontFamily: "monospace",
                    backgroundColor: "#083344",
                    padding: [2, 6, 4, 6],
                    borderRadius: [0, 0, 4, 4],
                    borderColor: COLOR.knee,
                    borderWidth: 1,
                  },
                },
                align: "right",
              },
            },
          ]
        : [];

      const option = {
        backgroundColor: "transparent",
        animationDuration: 200,
        grid: {
          top: 44,
          right: 36,
          bottom: 52,
          left: 56,
          containLabel: false,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "#101013",
          borderColor: "#3f3f46",
          borderWidth: 1,
          padding: [8, 10],
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const r: ExplorerRun = params.data?.run;
            if (!r) return "";
            const isKnee = kneePoint?.id === r.id;
            const statusBadge = isKnee
              ? `<span style='color:#67e8f9;font-weight:bold;'>KNEE</span><span style='color:#71717a;'> · best cost/solve trade-off</span>`
              : r.isFrontier
                ? `<span style='color:#34d399;font-weight:bold;'>FRONTIER</span><span style='color:#71717a;'> · undominated</span>`
                : `<span style='color:#71717a;'>DOMINATED</span>`;

            const other =
              costBasis === "today" ? r.costPerTaskReported : r.costPerTaskNormalized;
            const shown = costBasis === "today" ? r.costPerTaskNormalized : r.costPerTaskReported;
            // Never render $0 for a missing price — absence is "—", not zero.
            const shownLabel = shown !== null && shown !== undefined ? fmtUsd(shown) : "— (not restated)";

            const flag = (ok: boolean, label: string) =>
              `<span style="color:${ok ? "#d4d4d8" : "#3f3f46"};">${label}${ok ? " ✓" : " –"}</span>`;

            return `
              <div style="min-width: 250px; line-height: 1.55;">
                <div style="font-weight:bold; font-size: 13px; color:#ffffff;">
                  ${r.modelDisplayName}
                </div>
                <div style="color: #a1a1aa; font-size: 10px; margin-bottom: 6px;">
                  ${r.providerName} · ${r.harnessName} ${r.harnessVersion !== "default" ? "v" + r.harnessVersion : ""} · effort: ${r.effortPresetSlug}
                </div>
                <div style="margin-bottom: 6px; padding: 3px 0; border-top: 1px solid #27272a; border-bottom: 1px solid #27272a;">
                  <div>Solve rate: <strong style="color:#ffffff;">${r.solveRate.toFixed(1)}%</strong> <span style="color:#71717a;">(${r.nSolved}/${r.nTotal} tasks)</span></div>
                  <div>Cost / task: <strong style="color:#ffffff;">${shownLabel}</strong> <span style="color:#52525b;">(${costBasis})</span>${other !== null && other !== undefined && other !== shown ? ` <span style="color:#52525b;">· alt ${fmtUsd(other)}</span>` : ""}</div>
                  <div>Total run cost: <span style="color:#a1a1aa;">$${(r.costUsdReported ?? 0).toFixed(0)}</span></div>
                  ${r.latencyP50Seconds !== null && r.latencyP50Seconds !== undefined ? `<div>Latency p50: <span style="color:#a1a1aa;">${r.latencyP50Seconds.toFixed(1)}s</span></div>` : ""}
                </div>
                <div style="margin-bottom: 4px;">${statusBadge}</div>
                <div style="display:flex; gap: 6px; font-size: 9px; margin-bottom: 3px;">
                  ${flag(r.hasTokens, "TOK")}${flag(r.hasCost, "USD")}${flag(r.hasLatency, "LAT")}${flag(r.hasPassAtK, "P@K")}${flag(r.hasCi, "CI")}
                </div>
                <div style="font-size: 9px; color:#52525b;">source: ${r.sourceName}${r.sourceOfficial ? " (official)" : " (compiled)"} · click: pin · shift+click: dossier</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "log",
          logBase: 10,
          min: xMin,
          max: xMax,
          name: "USD per task (log)",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: COLOR.axisName, fontSize: 11, fontFamily: "monospace" },
          axisLabel: {
            color: COLOR.axisName,
            fontFamily: "monospace",
            fontSize: 11,
            formatter: (v: number) => fmtUsd(v),
          },
          splitLine: { lineStyle: { color: COLOR.grid, type: "dashed" } },
          axisLine: { lineStyle: { color: COLOR.axis } },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: yMax,
          name: "Solve rate (%)",
          nameLocation: "middle",
          nameGap: 40,
          nameTextStyle: { color: COLOR.axisName, fontSize: 11, fontFamily: "monospace" },
          axisLabel: {
            color: COLOR.axisName,
            fontFamily: "monospace",
            fontSize: 11,
            formatter: (v: number) => `${v}%`,
          },
          splitLine: { lineStyle: { color: COLOR.grid, type: "dashed" } },
          axisLine: { lineStyle: { color: COLOR.axis } },
        },
        series: [
          {
            name: "Frontier polyline",
            type: "line",
            data: polylineData,
            smooth: false,
            showSymbol: false,
            lineStyle: { color: COLOR.frontier, width: 2, opacity: 0.9, type: "solid" },
            silent: true,
            z: 2,
          },
          {
            name: "Configurations",
            type: "scatter",
            data: scatterData,
            markPoint: { data: markPointData },
            z: 3,
          },
        ],
      };

      chart.setOption(option, true);
      lastHoveredIndexRef.current = null;
    }

    initChart();

    return () => {
      isMounted = false;
    };
    // hoveredId intentionally excluded: hover emphasis is applied via
    // dispatchAction in the effect below so tooltips are not destroyed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, frontier, kneePoint, pinnedIds, costBasis, colorBy, categoryKeys]);

  // Hover sync (chart <-> table) without rebuilding the option.
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || validRuns.length === 0) return;

    const prevIndex = lastHoveredIndexRef.current;
    const nextIndex = hoveredId ? validRuns.findIndex((r) => r.id === hoveredId) : -1;

    if (prevIndex !== null && prevIndex !== nextIndex) {
      chart.dispatchAction({ type: "downplay", seriesIndex: 1, dataIndex: prevIndex });
    }
    if (nextIndex >= 0 && nextIndex !== prevIndex) {
      chart.dispatchAction({ type: "highlight", seriesIndex: 1, dataIndex: nextIndex });
    }
    lastHoveredIndexRef.current = nextIndex >= 0 ? nextIndex : null;
  }, [hoveredId, validRuns]);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[440px] bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pt-1 pb-2 border-b border-zinc-800/40 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 font-semibold uppercase tracking-wider">
            Cost vs solve rate
          </span>
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-400 font-medium">Frontier</span>
          </span>
          {kneePoint && (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
              <span className="text-cyan-400 font-medium">Knee</span>
            </span>
          )}
          {colorBy !== "none" ? (
            <span className="flex items-center gap-2.5 flex-wrap">
              {categoryKeys.slice(0, 6).map((k) => (
                <span key={k} className="flex items-center gap-1 text-zinc-400">
                  <span
                    className="h-2 w-2 rounded-full inline-block"
                    style={{ backgroundColor: categoryColor.get(k) ?? COLOR.dominated }}
                  />
                  {k}
                </span>
              ))}
              {categoryKeys.length > 6 && (
                <span className="text-zinc-600">+{categoryKeys.length - 6}</span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-zinc-500 opacity-50 inline-block" />
              <span className="text-zinc-500">Dominated</span>
            </span>
          )}
          {pinnedIds.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Pin size={10} />
              <span>Pinned ({pinnedIds.length})</span>
            </span>
          )}
        </div>

        <div className="text-[11px] text-zinc-500 font-mono">
          {validRuns.length}/{runs.length} plotted · x: USD/task log · y: solve %
        </div>
      </div>

      {!emptyMessage && validRuns.length < 8 && (
        <div className="mx-2 mt-2 rounded border border-amber-500/30 bg-amber-950/20 px-3 py-1.5 text-[11px] text-amber-200/90">
          Only {validRuns.length} of {runs.length} runs on this slice report cost — the
          configurations table below is the primary view here; the scatter draws the
          cost-bearing subset only.
        </div>
      )}

      {emptyMessage ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <span className="text-zinc-400 text-xs font-mono">{emptyMessage}</span>
          <span className="text-zinc-600 text-[11px]">
            Coverage rule: runs without cost telemetry are excluded from the frontier and never
            drawn at $0.
          </span>
        </div>
      ) : (
        <div ref={chartRef} className="flex-1 w-full min-h-[300px]" />
      )}
    </div>
  );
}

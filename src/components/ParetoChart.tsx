import React, { useEffect, useRef } from "react";
import type { ExplorerRun } from "../server/functions";

interface ParetoChartProps {
  runs: ExplorerRun[];
  frontier: ExplorerRun[];
  kneePoint: ExplorerRun | null;
  pinnedId: string | null;
  hoveredId: string | null;
  onSelectPin: (id: string | null) => void;
  onHoverPoint: (id: string | null) => void;
  costBasis: "reported" | "today";
}

export function ParetoChart({
  runs,
  frontier,
  kneePoint,
  pinnedId,
  hoveredId,
  onSelectPin,
  onHoverPoint,
  costBasis,
}: ParetoChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Filter runs to only those that have valid cost and solve rate
  const validRuns = runs.filter(
    (r) => r.hasCost && r.cost !== null && r.cost !== undefined && !Number.isNaN(r.cost)
  );

  useEffect(() => {
    let isMounted = true;

    async function initChart() {
      if (typeof window === "undefined" || !chartRef.current) return;

      // Dynamic import of ECharts in client only
      const echarts = await import("echarts");

      if (!isMounted || !chartRef.current) return;

      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current, "dark", {
          renderer: "svg",
        });

        chartInstanceRef.current.on("click", (params: any) => {
          if (params.data && params.data.runId) {
            onSelectPin(params.data.runId === pinnedId ? null : params.data.runId);
          }
        });

        chartInstanceRef.current.on("mouseover", (params: any) => {
          if (params.data && params.data.runId) {
            onHoverPoint(params.data.runId);
          }
        });

        chartInstanceRef.current.on("mouseout", () => {
          onHoverPoint(null);
        });

        const handleResize = () => {
          chartInstanceRef.current?.resize();
        };
        window.addEventListener("resize", handleResize);
      }

      if (validRuns.length === 0) {
        chartInstanceRef.current.setOption({
          backgroundColor: "#09090b",
          title: {
            text: "No valid cost/solve data available for this selection.",
            left: "center",
            top: "middle",
            textStyle: { color: "#71717a", fontSize: 13, fontFamily: "monospace" },
          },
          series: [],
        });
        return;
      }

      // Sort frontier by cost ascending for the polyline
      const sortedFrontier = [...frontier]
        .filter((r) => r.cost !== null)
        .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));

      const polylineData = sortedFrontier.map((r) => [r.cost, r.solveRate, r.id]);

      // Dominated vs Frontier scatter points
      const scatterData = validRuns.map((r) => {
        const isKnee = kneePoint?.id === r.id;
        const isPinned = pinnedId === r.id;
        const isHovered = hoveredId === r.id;

        let symbolSize = 10;
        let color = "#71717a"; // Dominated default: muted slate
        let borderColor = "#27272a";
        let borderWidth = 1;

        if (r.isFrontier) {
          symbolSize = 13;
          color = "#10b981"; // Emerald
          borderColor = "#059669";
          borderWidth = 2;
        }

        if (isKnee) {
          symbolSize = 18;
          color = "#06b6d4"; // Cyan focal
          borderColor = "#ffffff";
          borderWidth = 3;
        }

        if (isPinned) {
          symbolSize = Math.max(symbolSize, 16);
          borderColor = "#f59e0b"; // Amber pin
          borderWidth = 3;
        }

        if (isHovered) {
          symbolSize += 4;
        }

        return {
          name: r.modelDisplayName,
          value: [r.cost, r.solveRate],
          runId: r.id,
          run: r,
          itemStyle: {
            color,
            borderColor,
            borderWidth,
            shadowBlur: isKnee || isPinned ? 10 : 0,
            shadowColor: isKnee ? "#06b6d4" : isPinned ? "#f59e0b" : "transparent",
          },
          symbolSize,
        };
      });

      // Knee markPoint
      const markPointData = kneePoint
        ? [
            {
              name: "Knee Point",
              coord: [kneePoint.cost, kneePoint.solveRate],
              value: `KNEE: ${kneePoint.modelDisplayName}`,
              runId: kneePoint.id,
              itemStyle: {
                color: "#06b6d4",
                borderColor: "#ffffff",
                borderWidth: 1.5,
              },
              label: {
                show: true,
                formatter: (p: any) => `⚡ KNEE\n${kneePoint.modelDisplayName}`,
                position: "top",
                distance: 8,
                fontSize: 10,
                fontWeight: "bold",
                color: "#67e8f9",
                backgroundColor: "#083344",
                padding: [4, 6],
                borderRadius: 4,
                borderColor: "#06b6d4",
                borderWidth: 1,
              },
            },
          ]
        : [];

      const option = {
        backgroundColor: "#09090b",
        animationDuration: 300,
        grid: {
          top: 50,
          right: 40,
          bottom: 60,
          left: 65,
          containLabel: false,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "#18181b",
          borderColor: "#3f3f46",
          borderWidth: 1,
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const r: ExplorerRun = params.data?.run;
            if (!r) return "";
            const isKnee = kneePoint?.id === r.id;
            const statusBadge = isKnee
              ? "<span style='color:#67e8f9;font-weight:bold;'>⚡ KNEE (Best Cost/Solve Trade-off)</span>"
              : r.isFrontier
              ? "<span style='color:#34d399;font-weight:bold;'>✓ PARETO FRONTIER (Undominated)</span>"
              : "<span style='color:#a1a1aa;'>DOMINATED</span>";

            const costPerTask = (r.cost ?? 0).toFixed(2);
            const totalCost = (r.costUsdReported ?? 0).toFixed(0);

            return `
              <div style="min-width: 210px; line-height: 1.5;">
                <div style="font-weight:bold; font-size: 13px; color:#ffffff; margin-bottom: 2px;">
                  ${r.modelDisplayName}
                </div>
                <div style="color: #a1a1aa; font-size: 10px; margin-bottom: 6px;">
                  ${r.providerName} &bull; ${r.harnessName} (${r.effortPresetSlug})
                </div>
                <div style="margin-bottom: 6px; padding: 2px 0; border-top: 1px solid #27272a; border-bottom: 1px solid #27272a;">
                  <div>Solve Rate: <strong style="color:#ffffff;">${r.solveRate.toFixed(1)}%</strong> (${r.nSolved}/${r.nTotal} tasks)</div>
                  <div>Cost / Task: <strong style="color:#ffffff;">$${costPerTask}</strong></div>
                  <div>Total Cost: <span style="color:#a1a1aa;">$${totalCost}</span></div>
                </div>
                <div style="margin-bottom: 4px;">${statusBadge}</div>
                <div style="display:flex; gap: 4px; font-size: 9px; color:#71717a;">
                  <span>Tokens: ${r.hasTokens ? "✓" : "–"}</span> &bull;
                  <span>Latency: ${r.hasLatency ? "✓" : "–"}</span> &bull;
                  <span>CI: ${r.hasCi ? "✓" : "–"}</span>
                </div>
                <div style="font-size: 9px; color:#52525b; margin-top: 4px;">Click to pin</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "value",
          name: `Cost ($/Task) [${costBasis === "today" ? "Today" : "Reported"}]`,
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: "#a1a1aa", fontSize: 11, fontFamily: "monospace" },
          axisLabel: {
            color: "#71717a",
            fontFamily: "monospace",
            fontSize: 10,
            formatter: (v: number) => `$${v.toFixed(0)}`,
          },
          splitLine: {
            lineStyle: { color: "#18181b", type: "dashed" },
          },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
          type: "value",
          name: "Solve Rate (%)",
          nameLocation: "middle",
          nameGap: 45,
          min: 0,
          max: 60,
          nameTextStyle: { color: "#a1a1aa", fontSize: 11, fontFamily: "monospace" },
          axisLabel: {
            color: "#71717a",
            fontFamily: "monospace",
            fontSize: 10,
            formatter: (v: number) => `${v}%`,
          },
          splitLine: {
            lineStyle: { color: "#18181b", type: "dashed" },
          },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        series: [
          // 1. Polyline connecting frontier points
          {
            name: "Frontier Polyline",
            type: "line",
            data: polylineData,
            smooth: false,
            step: false,
            showSymbol: false,
            lineStyle: {
              color: "#10b981",
              width: 2,
              type: "solid",
            },
            z: 2,
          },
          // 2. Scatter points
          {
            name: "Configs",
            type: "scatter",
            data: scatterData,
            markPoint: {
              data: markPointData,
            },
            z: 3,
          },
        ],
      };

      chartInstanceRef.current.setOption(option, true);
    }

    initChart();

    return () => {
      isMounted = false;
    };
  }, [runs, frontier, kneePoint, pinnedId, hoveredId, costBasis]);

  return (
    <div className="relative w-full h-[380px] bg-zinc-950 rounded-lg border border-zinc-800/80 p-2 flex flex-col">
      <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-zinc-800/40 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-semibold uppercase tracking-wider">
            Cost vs Solve Efficiency
          </span>
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-400 font-medium">Pareto Frontier</span>
          </span>
          {kneePoint && (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
              <span className="text-cyan-400 font-medium">Knee: {kneePoint.modelDisplayName}</span>
            </span>
          )}
        </div>

        <div className="text-[10px] text-zinc-500">
          X: USD/Task &bull; Y: Benchmark Solve %
        </div>
      </div>

      <div ref={chartRef} className="flex-1 w-full h-full min-h-[300px]" />
    </div>
  );
}

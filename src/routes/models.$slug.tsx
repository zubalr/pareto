import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { Pin } from "lucide-react";
import { getModelData, type ExplorerRun } from "../server/functions";
import { useEChart } from "../components/ChartSlots";
import { parsePassAtK } from "../finder";

const searchSchema = z.object({
  benchmark: z.string().optional(),
});

export type ModelSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/models/$slug")({
  validateSearch: (search: Record<string, unknown>): ModelSearch => ({
    // Numeric-looking params arrive parsed as numbers — coerce to string.
    benchmark:
      search.benchmark === undefined || search.benchmark === null
        ? undefined
        : String(search.benchmark),
  }),
  loaderDeps: ({ search }) => ({ benchmark: search.benchmark }),
  loader: async ({ deps, params }) => {
    return await getModelData({
      data: { slug: params.slug, benchmarkVersionId: deps.benchmark },
    });
  },
  component: ModelPage,
});

function fmtUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}

function StatusBadge({ run }: { run: ExplorerRun }) {
  if (run.isKnee) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-bold text-[10px] tracking-wide">
        KNEE
      </span>
    );
  }
  if (run.isFrontier) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-semibold text-[10px] tracking-wide">
        FRONTIER
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800/60 text-zinc-500 text-[10px] tracking-wide">
      DOMINATED
    </span>
  );
}

function CoverageChips({ run }: { run: ExplorerRun }) {
  const chips = [
    { ok: run.hasTokens, label: "TOK", title: "Token counts reported" },
    { ok: run.hasCost, label: "USD", title: "Cost reported" },
    { ok: run.hasLatency, label: "LAT", title: "Latency measured" },
    { ok: run.hasPassAtK, label: "P@K", title: "Pass@k curve available" },
    { ok: run.hasCi, label: "CI", title: "Confidence interval reported" },
  ];
  return (
    <div className="flex items-center gap-1 text-[9px] font-mono">
      {chips.map((c) => (
        <span
          key={c.label}
          title={c.ok ? c.title : `Missing: ${c.title.toLowerCase()}`}
          className={`px-1 py-0.5 rounded border ${
            c.ok
              ? "bg-zinc-800/80 text-zinc-300 border-zinc-700"
              : "text-zinc-700 border-zinc-900 bg-transparent"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ModelMovementChart({
  runs,
  benchFrontier,
}: {
  runs: ExplorerRun[];
  benchFrontier: Array<{ cost: number; solveRate: number }>;
}) {
  const valid = runs.filter((r) => r.hasCost && r.cost !== null && r.cost > 0);
  const chartRef = useEChart(
    () => {
      const costs = valid.map((r) => r.cost as number);
      const minCost = Math.min(...costs, ...(benchFrontier.map((f) => f.cost) ?? []));
      const maxCost = Math.max(...costs, ...(benchFrontier.map((f) => f.cost) ?? [0]), 1);
      const maxSolve = Math.max(...valid.map((r) => r.solveRate), 10);

      return {
        backgroundColor: "transparent",
        animationDuration: 200,
        grid: { top: 36, right: 28, bottom: 46, left: 56 },
        tooltip: {
          trigger: "item",
          backgroundColor: "#101013",
          borderColor: "#3f3f46",
          borderWidth: 1,
          textStyle: { color: "#f4f4f5", fontSize: 11, fontFamily: "monospace" },
          formatter: (params: any) => {
            const r = valid[params.dataIndex];
            if (!r) return "";
            const passK = parsePassAtK(r.passAtK);
            return `
              <div style="min-width: 200px; line-height: 1.55;">
                <div style="font-weight:bold; color:#fff;">${r.harnessName} ${r.harnessVersion !== "default" ? "v" + r.harnessVersion : ""}</div>
                <div style="color:#a1a1aa; font-size:10px; margin-bottom:4px;">effort: ${r.effortPresetSlug}</div>
                <div>Solve: <strong style="color:#fff;">${r.solveRate.toFixed(1)}%</strong> · $/task: <strong style="color:#fff;">${fmtUsd(r.cost ?? 0)}</strong></div>
                <div style="color:#71717a; font-size:9px;">${r.isKnee ? "KNEE · " : r.isFrontier ? "frontier · " : "dominated · "}${r.nSolved}/${r.nTotal} tasks${passK.length ? ` · pass@k: ${passK.map((p) => `k${p.k}=${p.percent}%`).join(", ")}` : ""}</div>
              </div>
            `;
          },
        },
        xAxis: {
          type: "log",
          logBase: 10,
          min: minCost / 1.5,
          max: maxCost * 1.25,
          name: "USD per task (log)",
          nameLocation: "middle",
          nameGap: 28,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, formatter: (v: number) => fmtUsd(v) },
          splitLine: { lineStyle: { color: "#18181b", type: "dashed" } },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: Math.min(100, Math.ceil((maxSolve * 1.15) / 10) * 10),
          name: "Solve rate (%)",
          nameLocation: "middle",
          nameGap: 40,
          nameTextStyle: { color: "#a1a1aa", fontSize: 10, fontFamily: "monospace" },
          axisLabel: { color: "#71717a", fontFamily: "monospace", fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: "#18181b", type: "dashed" } },
          axisLine: { lineStyle: { color: "#27272a" } },
        },
        series: [
          {
            name: "Bench frontier",
            type: "line",
            data: benchFrontier.map((f) => [f.cost, f.solveRate]),
            smooth: false,
            showSymbol: false,
            lineStyle: { color: "#10b981", width: 1.5, opacity: 0.35, type: "dashed" },
            silent: true,
            z: 2,
          },
          {
            name: "This model",
            type: "scatter",
            data: valid.map((r) => ({
              value: [r.cost, r.solveRate],
              itemStyle: {
                color: r.isKnee ? "#06b6d4" : r.isFrontier ? "#10b981" : "#52525b",
                borderColor: r.isKnee ? "#ffffff" : r.isFrontier ? "#064e3b" : "#18181b",
                borderWidth: r.isKnee ? 2 : 1.5,
                opacity: r.isFrontier || r.isKnee ? 1 : 0.55,
              },
              symbolSize: r.isKnee ? 15 : r.isFrontier ? 12 : 8,
            })),
            z: 3,
          },
        ],
      };
    },
    [valid, benchFrontier]
  );

  return (
    <div className="bg-zinc-950 rounded border border-zinc-800/80 p-2 flex flex-col">
      <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-zinc-800/40 text-[11px]">
        <span className="text-zinc-300 font-semibold uppercase tracking-wider">
          Movement across harnesses / efforts
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          {valid.length} plotted · dashed: bench frontier
        </span>
      </div>
      <div ref={chartRef} className="w-full h-[300px]" />
    </div>
  );
}

function ModelPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const benchmarkId = search.benchmark || data.currentBenchmark?.id || "";

  const runs = [...data.runs].sort((a, b) => (b.solveRate ?? 0) - (a.solveRate ?? 0));
  const withCost = runs.filter((r) => r.hasCost && r.cost !== null && r.cost > 0);
  const bestSolve = runs.length ? Math.max(...runs.map((r) => r.solveRate)) : 0;
  const cheapest = withCost.length ? Math.min(...withCost.map((r) => r.cost as number)) : null;
  const frontierCount = runs.filter((r) => r.isFrontier).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-1.5 text-[11px] flex items-center justify-between gap-4 text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">NOTE</span>
          <span>
            Compiled/seed numbers — illustrative eval runs, not an official leaderboard.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <span>reported cost basis</span>
          <span>&bull;</span>
          <a href="/methodology" className="underline hover:text-zinc-300">
            methodology
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              <Link
                to="/"
                search={{ benchmark: benchmarkId || undefined }}
                className="underline hover:text-zinc-300"
              >
                Explorer
              </Link>{" "}
              / model
            </div>
            <h1 className="text-lg font-bold text-zinc-100">
              {data.model ? data.model.displayName : `Unknown model: ${slug}`}
              {data.model && (
                <span className="text-xs text-zinc-500 font-mono ml-2">{data.model.providerName} · {slug}</span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Benchmark</label>
            <select
              value={benchmarkId}
              onChange={(e) => navigate({ search: { benchmark: e.target.value }, replace: true })}
              aria-label="Benchmark version"
              className="bg-zinc-900 border border-emerald-500/40 text-zinc-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
            >
              {data.benchmarkOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data.error && (
          <div className="bg-zinc-950 border border-zinc-800/80 rounded p-4 text-xs text-zinc-400">
            {data.error}{" "}
            <span className="text-zinc-600">
              ({data.benchRunCount} runs exist on this benchmark slice — this model has none here.)
            </span>
          </div>
        )}

        {data.model && (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="bg-zinc-950 border border-zinc-800/80 rounded px-2.5 py-2">
                <div className="text-[9px] uppercase text-zinc-500 font-semibold tracking-wider">Runs here</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{runs.length}</div>
                <div className="text-[10px] text-zinc-500">of {data.benchRunCount} on the slice</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded px-2.5 py-2">
                <div className="text-[9px] uppercase text-zinc-500 font-semibold tracking-wider">Best solve</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{bestSolve.toFixed(1)}%</div>
                <div className="text-[10px] text-zinc-500">across harnesses / efforts</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded px-2.5 py-2">
                <div className="text-[9px] uppercase text-zinc-500 font-semibold tracking-wider">Cheapest</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">
                  {cheapest !== null ? `${fmtUsd(cheapest)}/task` : "—"}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {cheapest === null ? "no cost telemetry" : "reported basis"}
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded px-2.5 py-2">
                <div className="text-[9px] uppercase text-zinc-500 font-semibold tracking-wider">On frontier</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{frontierCount}</div>
                <div className="text-[10px] text-zinc-500">undominated configurations</div>
              </div>
            </div>

            {withCost.length > 0 ? (
              <ModelMovementChart runs={runs} benchFrontier={data.benchFrontier} />
            ) : (
              <div className="bg-zinc-950 rounded border border-zinc-800/60 px-3 py-2 text-[10px] text-zinc-500">
                No cost telemetry for this model on this benchmark — movement chart suppressed
                (coverage rule).
              </div>
            )}

            {runs.length >= 2 && (
              <Link
                to="/compare"
                search={{
                  ids: runs.slice(0, 8).map((r) => r.id).join(","),
                  benchmark: benchmarkId || undefined,
                }}
                className="text-[11px] text-cyan-300 hover:text-cyan-200 underline self-start"
              >
                Compare these {Math.min(runs.length, 8)} runs side by side →
              </Link>
            )}

            {/* Runs table */}
            <div className="bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60 text-[11px] text-zinc-400">
                <span className="font-semibold uppercase tracking-wider">Configurations</span>
                <span className="text-zinc-600 mx-2">|</span>
                <span className="font-mono">{runs.length} runs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Harness</th>
                      <th className="px-3 py-2 font-semibold">Effort</th>
                      <th className="px-3 py-2 font-semibold">Solve rate</th>
                      <th className="px-3 py-2 font-semibold">$/task</th>
                      <th className="px-3 py-2 font-semibold">$/resolved</th>
                      <th className="px-3 py-2 font-semibold">p50</th>
                      <th className="px-3 py-2 font-semibold">Pass@k</th>
                      <th className="px-3 py-2 font-semibold">Coverage</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {runs.map((r) => {
                      const perResolved =
                        r.costUsdReported !== null && r.costUsdReported !== undefined && r.nSolved > 0
                          ? r.costUsdReported / r.nSolved
                          : null;
                      const passK = parsePassAtK(r.passAtK);
                      return (
                        <tr key={r.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                          <td className="px-3 py-2">
                            <Link
                              to="/runs/$id"
                              params={{ id: r.id }}
                              title="Open run dossier"
                              className="hover:opacity-80"
                            >
                              <StatusBadge run={r} />
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-zinc-200">
                            {r.harnessName}{" "}
                            <span className="text-zinc-500 text-[10px]">
                              {r.harnessVersion !== "default" ? `v${r.harnessVersion}` : ""}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] uppercase font-mono">
                              {r.effortPresetSlug}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-bold text-zinc-100">{r.solveRate.toFixed(1)}%</span>{" "}
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {r.nSolved}/{r.nTotal}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-zinc-200 font-mono">
                            {r.cost !== null ? `$${(r.cost as number).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-300 font-mono">
                            {perResolved !== null ? `$${perResolved.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-400 font-mono">
                            {r.latencyP50Seconds != null ? `${r.latencyP50Seconds.toFixed(1)}s` : "—"}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-zinc-400 font-mono">
                            {passK.length > 0
                              ? passK.map((p) => `k${p.k}:${p.percent}%`).join(" ")
                              : <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <CoverageChips run={r} />
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] ${r.sourceOfficial ? "text-emerald-500/80" : "text-zinc-500"}`}
                              title={r.sourceRunId}
                            >
                              {r.sourceName}
                              {r.sourceOfficial ? " ●" : " ○"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {runs.length === 0 && (
                      <tr className="bg-zinc-950">
                        <td colSpan={10} className="px-3 py-6 text-center text-zinc-500">
                          No runs for this model on the selected benchmark.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10px] text-zinc-600">
              Frontier/knee badges are computed against every run on this benchmark slice (reported
              basis), so they match the Explorer board for the same slice. Pinning and filters live
              on the <Link to="/" search={{ benchmark: benchmarkId || undefined }} className="underline hover:text-zinc-400">Explorer</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

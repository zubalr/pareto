import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { Columns3 } from "lucide-react";
import { getCompareData } from "../server/functions";
import type { ExplorerRun } from "../server/functions";
import { parseListParam } from "../compare";
import { benchLabel } from "../components/FilterRail";

const searchSchema = z.object({
  benchmark: z.string().optional(),
  ids: z.string().optional(),
  slugs: z.string().optional(),
  costBasis: z.enum(["reported", "today"]).optional(),
});

export type CompareSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const coerceString = (v: unknown): string | undefined =>
      v === undefined || v === null ? undefined : String(v);
    return {
      benchmark: coerceString(search.benchmark),
      ids: coerceString(search.ids),
      slugs: coerceString(search.slugs),
      costBasis: search.costBasis === "today" ? "today" : "reported",
    };
  },
  loaderDeps: ({ search }) => ({
    benchmark: search.benchmark,
    ids: search.ids,
    slugs: search.slugs,
    costBasis: search.costBasis,
  }),
  loader: async ({ deps }) => {
    return await getCompareData({
      data: {
        benchmarkVersionId: deps.benchmark,
        ids: parseListParam(deps.ids),
        slugs: parseListParam(deps.slugs),
        costBasis: deps.costBasis === "today" ? "today" : "reported",
      },
    });
  },
  component: ComparePage,
});

function fmtUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function StatusBadge({ run }: { run: ExplorerRun }) {
  if (run.isKnee) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-bold text-[11px] tracking-wide">
        KNEE
      </span>
    );
  }
  if (run.isFrontier) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-semibold text-[11px] tracking-wide">
        FRONTIER
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800/60 text-zinc-500 text-[11px] tracking-wide">
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
    <div className="flex items-center gap-1 text-[11px] font-mono">
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

function ComparePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const benchmarkId = search.benchmark || data.currentBenchmark?.id || "";
  const ids = parseListParam(search.ids);
  const slugs = parseListParam(search.slugs);
  const costBasis = search.costBasis ?? "reported";

  const runs = data.selected;
  const has = runs.length > 0;

  // Best-value highlights per numeric column (only among runs that report the metric).
  const bestSolve = has ? Math.max(...runs.map((r) => r.solveRate)) : null;
  const costed = has ? runs.filter((r) => r.hasCost && r.cost !== null && r.cost > 0) : [];
  const bestCost = costed.length ? Math.min(...costed.map((r) => r.cost as number)) : null;
  const basisTotal = (r: ExplorerRun): number | null =>
    costBasis === "today" ? r.costUsdNormalized : r.costUsdReported;
  const resolvedVals = costed
    .filter((r) => r.nSolved > 0 && basisTotal(r) !== null)
    .map((r) => (basisTotal(r) as number) / r.nSolved);
  const bestResolved = resolvedVals.length ? Math.min(...resolvedVals) : null;

  const updateBenchmark = (value: string) => {
    navigate({ search: (prev: CompareSearch) => ({ ...prev, benchmark: value }), replace: true });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-1.5 text-[11px] flex items-center justify-between gap-4 text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">NOTE</span>
          <span>
            Compare matrix — compiled/seed runs on one benchmark, side by side. Not an official
            ranking.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
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
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
              <Link to="/" search={{ benchmark: benchmarkId || undefined }} className="underline hover:text-zinc-300">
                Explorer
              </Link>{" "}
              / compare
            </div>
            <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Columns3 size={16} className="text-cyan-400" />
              Compare matrix
              <span className="text-xs text-zinc-500 font-mono">
                {runs.length > 0 ? `${runs.length} configuration${runs.length === 1 ? "" : "s"}` : ""}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Benchmark</label>
            <select
              value={benchmarkId}
              onChange={(e) => updateBenchmark(e.target.value)}
              aria-label="Benchmark version (single choice)"
              className="bg-zinc-900 border border-emerald-500/40 text-zinc-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
            >
              {data.benchmarkOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {benchLabel(b)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection diagnostics — honest about what did not resolve */}
        {(data.unknownIds.length > 0 || data.unknownSlugs.length > 0) && (
          <div className="bg-amber-950/20 border border-amber-500/30 rounded px-3 py-2 text-[11px] text-amber-200/90">
            Not on {data.currentBenchmark?.benchmarkName} {data.currentBenchmark?.version}:
            {data.unknownIds.length > 0 && (
              <span className="font-mono text-[11px]"> ids: {data.unknownIds.join(", ")}</span>
            )}
            {data.unknownSlugs.length > 0 && (
              <span className="font-mono text-[11px]">
                {" "}slugs: {data.unknownSlugs.join(", ")}
              </span>
            )}
            <span className="text-amber-200/60">
              {" "}— pins from other benchmark versions never mix into this matrix.
            </span>
          </div>
        )}
        {data.truncated && (
          <div className="bg-zinc-950 border border-zinc-800/60 rounded px-3 py-2 text-[11px] text-zinc-400">
            Selection capped at 8 rows — extend by removing pins rather than accumulating more.
          </div>
        )}

        {runs.length < 2 ? (
          <div className="bg-zinc-950 border border-zinc-800/80 rounded p-6 flex flex-col items-center gap-2 text-center">
            <span className="text-zinc-300 text-xs font-mono">
              {runs.length === 0
                ? "Nothing pinned yet."
                : "Pin at least two configurations to compare."}
            </span>
            <span className="text-zinc-500 text-[11px]">
              On the{" "}
              <Link to="/" search={{ benchmark: benchmarkId || undefined }} className="underline hover:text-zinc-300">
                Explorer
              </Link>
              , click rows or chart points to pin (the pin ring toggles), then use “Compare pins”.
              You can also arrive here from a Finder result or a model page.
            </span>
          </div>
        ) : (
          <div className="bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden">
            <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">
                {data.currentBenchmark?.benchmarkName} {data.currentBenchmark?.version}
              </span>
              <span className="text-zinc-500 text-[11px] font-mono">
                {costBasis === "today"
                  ? "today basis — runs without restated pricing show —"
                  : "reported basis"}{" "}
                · best per column bolded · badges match the Explorer board
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Configuration</th>
                    <th className="px-3 py-2 font-semibold">Solve rate</th>
                    <th className="px-3 py-2 font-semibold">$/task</th>
                    <th className="px-3 py-2 font-semibold">$/resolved</th>
                    <th className="px-3 py-2 font-semibold">Pass@k</th>
                    <th className="px-3 py-2 font-semibold">Tokens</th>
                    <th className="px-3 py-2 font-semibold">p50</th>
                    <th className="px-3 py-2 font-semibold">Coverage</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {runs.map((r) => {
                    const basisTotalR = basisTotal(r);
                    const perResolved =
                      basisTotalR !== null && basisTotalR !== undefined && r.nSolved > 0
                        ? basisTotalR / r.nSolved
                        : null;
                    const tokens =
                      r.hasTokens && (r.tokensIn !== null || r.tokensOut !== null)
                        ? (r.tokensIn ?? 0) + (r.tokensOut ?? 0)
                        : null;
                    const isBestSolve = bestSolve !== null && r.solveRate === bestSolve;
                    const isBestCost =
                      bestCost !== null && r.cost !== null && (r.cost as number) === bestCost;
                    const isBestResolved =
                      bestResolved !== null && perResolved !== null && perResolved === bestResolved;
                    return (
                      <tr key={r.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                        <td className="px-3 py-2">
                          <StatusBadge run={r} />
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            to="/models/$slug"
                            params={{ slug: r.modelSlug }}
                            search={{ benchmark: benchmarkId || undefined }}
                            className="font-semibold text-zinc-100 hover:text-emerald-400 hover:underline"
                          >
                            {r.modelDisplayName}
                          </Link>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {r.harnessName}
                            {r.harnessVersion !== "default" ? ` v${r.harnessVersion}` : ""} ·{" "}
                            {r.effortPresetSlug}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`${isBestSolve ? "font-bold text-emerald-400" : "font-bold text-zinc-100"}`}>
                            {r.solveRate.toFixed(1)}%
                          </span>{" "}
                          <span className="text-[11px] text-zinc-500 font-mono">
                            {r.nSolved}/{r.nTotal}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {r.cost !== null ? (
                            <span className={isBestCost ? "font-bold text-emerald-400" : "text-zinc-200"}>
                              ${(r.cost as number).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-600" title="No cost telemetry">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {perResolved !== null ? (
                            <span className={isBestResolved ? "font-bold text-emerald-400" : "text-zinc-300"}>
                              ${perResolved.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-zinc-400 font-mono whitespace-nowrap">
                          {r.hasPassAtK ? (
                            <PassKInline json={r.passAtK} />
                          ) : (
                            <span className="text-zinc-600" title="No pass@k telemetry">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-300 font-mono" title={tokens !== null ? `${r.tokensIn ?? 0} in / ${r.tokensOut ?? 0} out` : "No token telemetry"}>
                          {tokens !== null ? fmtTokens(tokens) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-3 py-2 text-zinc-400 font-mono">
                          {r.latencyP50Seconds != null ? (
                            `${r.latencyP50Seconds.toFixed(1)}s`
                          ) : (
                            <span className="text-zinc-600" title="No latency telemetry">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <CoverageChips run={r} />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] ${r.sourceOfficial ? "text-emerald-500/80" : "text-zinc-500"}`}
                            title={r.sourceRunId}
                          >
                            {r.sourceName}
                            {r.sourceOfficial ? " ●" : " ○"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[11px] text-zinc-600">
          Pins are per benchmark version by construction: pins carried from another board appear in
          the “Not on …” note above instead of the matrix. Frontier/knee badges are computed against
          every run on this benchmark slice (reported basis).
        </p>
      </div>
    </div>
  );
}

function PassKInline({ json }: { json: string }) {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .map(([k, v]) => ({ k: Number(k), v: Number(v) }))
      .filter((e) => Number.isFinite(e.k) && Number.isFinite(e.v))
      .sort((a, b) => a.k - b.k);
    if (entries.length === 0) return <span className="text-zinc-600">—</span>;
    return (
      <span>
        {entries.map((e) => (
          <span key={e.k} className="mr-1.5">
            k{e.k}:<span className="text-zinc-200">{e.v}%</span>
          </span>
        ))}
      </span>
    );
  } catch {
    return <span className="text-zinc-600">—</span>;
  }
}

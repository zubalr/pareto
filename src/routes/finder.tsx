import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { CircleDollarSign, Timer, Target } from "lucide-react";
import { getFinderData } from "../server/functions";
import { selectFinder, FinderObjective } from "../finder";

const searchSchema = z.object({
  benchmark: z.string().optional(),
  maxCost: z.string().optional(),
  maxLatency: z.string().optional(),
  minSolve: z.string().optional(),
  objective: z.enum(["max-solve", "min-cost-per-resolved", "cheapest-at-floor"]).optional(),
  costBasis: z.enum(["reported", "today"]).optional(),
});

export type FinderSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/finder")({
  validateSearch: (search: Record<string, unknown>): FinderSearch => {
    // TanStack Router parses numeric-looking params as numbers — coerce back
    // to string so `?maxCost=33` and `?maxCost=%2233%22` both round-trip.
    const coerceString = (v: unknown): string | undefined =>
      v === undefined || v === null ? undefined : String(v);
    return {
      benchmark: coerceString(search.benchmark),
      maxCost: coerceString(search.maxCost),
      maxLatency: coerceString(search.maxLatency),
      minSolve: coerceString(search.minSolve),
      objective:
        search.objective === "min-cost-per-resolved"
          ? "min-cost-per-resolved"
          : search.objective === "cheapest-at-floor"
            ? "cheapest-at-floor"
            : search.objective === "max-solve"
              ? "max-solve"
              : undefined,
      costBasis: search.costBasis === "today" ? "today" : "reported",
    };
  },
  loaderDeps: ({ search }) => ({ benchmark: search.benchmark, costBasis: search.costBasis }),
  loader: async ({ deps }) => {
    return await getFinderData({
      data: {
        benchmarkVersionId: deps.benchmark,
        costBasis: deps.costBasis === "today" ? "today" : "reported",
      },
    });
  },
  component: FinderPage,
});

function fmtUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(2)}`;
}

function ConfigCard({
  run,
  rank,
  tone,
}: {
  run: {
    id: string;
    modelDisplayName: string;
    modelSlug: string;
    harnessName: string;
    effortPresetSlug: string;
    solveRate: number;
    cost: number | null;
    costUsdTotal: number | null;
    nSolved: number;
    latencyP50Seconds: number | null;
    sourceName: string;
    sourceOfficial: boolean;
    sourceRunId: string;
  };
  rank: string;
  tone: "best" | "alt";
}) {
  const perResolved =
    run.costUsdTotal !== null && run.costUsdTotal !== undefined && run.nSolved > 0
      ? run.costUsdTotal / run.nSolved
      : null;
  const border =
    tone === "best" ? "border-cyan-500/40" : "border-zinc-800/80";
  return (
    <div className={`bg-zinc-950 border ${border} rounded p-3 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-[9px] uppercase font-bold tracking-wider ${
            tone === "best" ? "text-cyan-400" : "text-zinc-500"
          }`}
        >
          {rank}
        </span>
        <span className="text-[9px] font-mono text-zinc-600">{run.sourceRunId}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <Link
          to="/models/$slug"
          params={{ slug: run.modelSlug }}
          className="text-base font-bold text-zinc-100 hover:text-emerald-400 hover:underline"
        >
          {run.modelDisplayName}
        </Link>
        <span className="text-sm font-bold font-mono text-zinc-100">
          {run.solveRate.toFixed(1)}%
        </span>
      </div>
      <div className="text-[10px] text-zinc-400 font-mono">
        {run.harnessName} · {run.effortPresetSlug}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-zinc-400 border-t border-zinc-800/80 pt-1.5 mt-0.5">
        <span>
          $/task <span className="text-zinc-100 font-mono">{run.cost !== null ? fmtUsd(run.cost) : "—"}</span>
        </span>
        <span>
          $/resolved{" "}
          <span className="text-zinc-100 font-mono">{perResolved !== null ? fmtUsd(perResolved) : "—"}</span>
        </span>
        <span>
          Total <span className="text-zinc-100 font-mono">{run.costUsdTotal != null ? `$${run.costUsdTotal.toFixed(0)}` : "—"}</span>
        </span>
        <span>
          p50 <span className="text-zinc-100 font-mono">{run.latencyP50Seconds != null ? `${run.latencyP50Seconds.toFixed(1)}s` : "—"}</span>
        </span>
      </div>
      <div className="text-[9px] text-zinc-500 flex items-center justify-between">
        <span>
          source: {run.sourceName}
          {run.sourceOfficial ? " (official)" : " (compiled)"} · n={run.nSolved} resolved
        </span>
        <Link
          to="/runs/$id"
          params={{ id: run.id }}
          className="text-cyan-400 hover:text-cyan-300 underline shrink-0 ml-2"
          title="Open run dossier"
        >
          dossier
        </Link>
      </div>
    </div>
  );
}

function FinderPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const benchmarkId = search.benchmark || data.currentBenchmark?.id || "";
  const maxCost = search.maxCost ?? "50";
  const maxLatency = search.maxLatency ?? "";
  const minSolve = search.minSolve ?? "";
  const objective: FinderObjective = search.objective ?? "max-solve";
  const costBasis = search.costBasis ?? "reported";

  const updateSearch = (patch: Partial<FinderSearch>) => {
    navigate({ search: (prev: FinderSearch) => ({ ...prev, ...patch }), replace: true });
  };

  const capNum = Number(maxCost);
  const latNum = Number(maxLatency);
  const minSolveNum = Number(minSolve);
  const result = React.useMemo(() => {
    if (!Number.isFinite(capNum) || capNum <= 0) return null;
    return selectFinder(data.candidates, {
      maxCostPerTask: capNum,
      maxLatencyP50Seconds: maxLatency && Number.isFinite(latNum) && latNum > 0 ? latNum : null,
      objective,
      minSolve: objective === "cheapest-at-floor" && minSolve && Number.isFinite(minSolveNum) ? minSolveNum : null,
    });
  }, [data.candidates, capNum, latNum, maxLatency, minSolve, minSolveNum, objective]);

  const overBudget = (result?.excluded ?? []).filter((e) => e.reason === "over-budget");
  const cheapestOverBudget = overBudget.length
    ? overBudget.reduce((min, e) => ((e.run.cost ?? Infinity) < (min.run.cost ?? Infinity) ? e : min))
    : null;
  const noCost = (result?.excluded ?? []).filter((e) => e.reason === "no-cost-telemetry");
  const latencyExcluded = (result?.excluded ?? []).filter(
    (e) => e.reason === "no-latency-telemetry" || e.reason === "over-latency-budget"
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* Same compiled-data banner as the Explorer — a recommendation surface needs it most */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-1.5 text-[11px] flex items-center justify-between gap-4 text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">NOTE</span>
          <span>
            Finder applies your budget to compiled/seed runs — deterministic filter, not an official
            ranking.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <span>{costBasis === "today" ? "today basis — runs without restated pricing excluded" : "reported cost basis"}</span>
          <span>&bull;</span>
          <a href="/methodology" className="underline hover:text-zinc-300">
            rules
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Input rail */}
        <aside className="w-full lg:w-60 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800/80 p-3.5 flex flex-col gap-5 text-xs shrink-0 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <CircleDollarSign size={12} className="text-zinc-500" />
              Benchmark
            </label>
            <select
              value={benchmarkId}
              onChange={(e) => updateSearch({ benchmark: e.target.value })}
              aria-label="Benchmark version (required, single choice)"
              className="w-full bg-zinc-900 border border-emerald-500/40 hover:border-emerald-500/70 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
            >
              {data.benchmarkOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Target size={12} className="text-zinc-500" />
              Max $ / task
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={maxCost}
              onChange={(e) => updateSearch({ maxCost: e.target.value })}
              aria-label="Maximum cost per task in USD"
              className="w-full bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono"
            />
            <div className="grid grid-cols-4 gap-1">
              {["10", "25", "50", "100"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateSearch({ maxCost: preset })}
                  className={`py-0.5 rounded border text-[10px] font-mono transition-colors ${
                    maxCost === preset
                      ? "border-emerald-500/60 text-emerald-400 bg-zinc-800"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Timer size={12} className="text-zinc-500" />
              Max p50 latency (s)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={maxLatency}
              onChange={(e) => updateSearch({ maxLatency: e.target.value })}
              placeholder="no cap"
              aria-label="Maximum p50 latency in seconds, optional"
              className="w-full bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono placeholder:text-zinc-600"
            />
            <p className="text-[9px] text-zinc-500 leading-snug">
              Runs without measured latency are excluded while a cap is set — unmeasured is not
              "within budget".
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Objective
            </label>
            <div className="flex flex-col gap-0.5">
              {(
                [
                  ["max-solve", "Max solve rate"],
                  ["min-cost-per-resolved", "Min $ / resolved"],
                  ["cheapest-at-floor", "Cheapest at solve floor"],
                ] as Array<[FinderObjective, string]>
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
                >
                  <input
                    type="radio"
                    name="objective"
                    checked={objective === value}
                    onChange={() => updateSearch({ objective: value })}
                    className="bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                  />
                  {label}
                </label>
              ))}
            </div>
            {objective === "cheapest-at-floor" && (
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[10px] text-zinc-400" htmlFor="min-solve">
                  Min solve floor (%)
                </label>
                <input
                  id="min-solve"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={minSolve}
                  onChange={(e) => updateSearch({ minSolve: e.target.value })}
                  placeholder="e.g. 35"
                  aria-label="Minimum solve rate percent for cheapest-at-floor"
                  className="w-full bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 font-mono placeholder:text-zinc-600"
                />
                <p className="text-[9px] text-zinc-500 leading-snug">
                  Cheapest run whose solve rate ≥ floor. Runs below the floor are excluded, not
                  silently accepted.
                </p>
              </div>
            )}
            <p className="text-[9px] text-zinc-500 leading-snug">
              $/resolved = total run cost ÷ resolved tasks. It hides failures — read it next to
              solve rate.
            </p>
          </div>

          <p className="text-[9px] text-zinc-600 leading-snug mt-auto">
            Eligibility requires reported cost ≤ cap. Runs without cost telemetry are never assumed
            within budget.
          </p>
        </aside>

        {/* Results */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto min-h-0">
          {data.error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
              <strong>Database notice:</strong> {data.error}
            </div>
          )}

          {!result ? (
            <div className="bg-zinc-950 border border-zinc-800/80 rounded p-6 text-center text-zinc-400 text-xs">
              Enter a max $/task above to filter the slice.
            </div>
          ) : (
            <>
              {result.best ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ConfigCard run={result.best} rank="Best fit" tone="best" />
                    {result.alternatives.map((alt, i) => (
                      <ConfigCard key={alt.id} run={alt} rank={`Alternative ${i + 1}`} tone="alt" />
                    ))}
                    {result.alternatives.length === 0 && (
                      <div className="bg-zinc-950 border border-zinc-800/80 rounded p-3 text-[11px] text-zinc-500 flex items-center justify-center text-center">
                        No other eligible configuration in this slice.
                      </div>
                    )}
                    {result.alternatives.length === 1 && <div className="hidden md:block" />}
                  </div>
                  <Link
                    to="/compare"
                    search={{
                      ids: [result.best, ...result.alternatives].map((r) => r.id).join(","),
                      benchmark: benchmarkId || undefined,
                    }}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200 underline inline-flex items-center gap-1 self-start"
                  >
                    Compare best + alternatives side by side →
                  </Link>
                </>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800/80 rounded p-6 flex flex-col items-center gap-2 text-center">
                  <span className="text-zinc-300 text-xs font-mono">
                    Nothing within ${maxCost}/task
                    {maxLatency ? ` and ${maxLatency}s p50` : ""} on this benchmark.
                  </span>
                  {cheapestOverBudget && (
                    <span className="text-zinc-500 text-[11px]">
                      Closest option:{" "}
                      <span className="text-zinc-300">{cheapestOverBudget.run.modelDisplayName}</span>{" "}
                      at{" "}
                      <span className="text-zinc-300 font-mono">
                        {fmtUsd(cheapestOverBudget.run.cost ?? 0)}/task
                      </span>{" "}
                      ({fmtUsd((cheapestOverBudget.run.cost ?? 0) - capNum)} over cap)
                    </span>
                  )}
                </div>
              )}

              {/* Excluded-for-budget ledger */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded flex flex-col">
                <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-zinc-400">
                    Excluded · {result.excluded.length} of {data.candidates.length} runs
                  </span>
                  <span className="text-zinc-500 text-[10px] font-mono">
                    {result.eligible.length} eligible · best of {result.eligible.length} shown
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-zinc-900/90 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold">Run</th>
                        <th className="px-3 py-1.5 font-semibold">Config</th>
                        <th className="px-3 py-1.5 font-semibold">$/task</th>
                        <th className="px-3 py-1.5 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {result.excluded.map((e) => (
                        <tr key={e.run.id} className="bg-zinc-950">
                          <td className="px-3 py-1.5 text-zinc-300">{e.run.modelDisplayName}</td>
                          <td className="px-3 py-1.5 text-zinc-500 text-[10px] font-mono">
                            {e.run.harnessName} · {e.run.effortPresetSlug}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400 font-mono">
                            {e.run.cost !== null ? fmtUsd(e.run.cost) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded border font-mono ${
                                e.reason === "over-budget"
                                  ? "border-amber-500/40 text-amber-400 bg-amber-950/20"
                                  : e.reason === "no-cost-telemetry"
                                    ? "border-zinc-700 text-zinc-400 bg-zinc-900"
                                    : "border-zinc-800 text-zinc-500"
                              }`}
                            >
                              {e.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {result.excluded.length === 0 && (
                        <tr className="bg-zinc-950">
                          <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                            Nothing excluded — every run on this benchmark is eligible.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {(noCost.length > 0 || latencyExcluded.length > 0) && (
                <p className="text-[10px] text-zinc-500">
                  Coverage note: {noCost.length} run(s) lack cost telemetry and {latencyExcluded.length}{" "}
                  fail the latency constraint — they are excluded, never coerced into budget.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

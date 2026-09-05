import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { getExplorerData } from "../server/functions";
import { ParetoChart } from "../components/ParetoChart";
import { DataTable } from "../components/DataTable";
import { FilterRail } from "../components/FilterRail";

const searchSchema = z.object({
  benchmark: z.string().optional(),
  models: z.array(z.string()).optional(),
  harnesses: z.array(z.string()).optional(),
  efforts: z.array(z.string()).optional(),
  costBasis: z.enum(["reported", "today"]).optional(),
  pinned: z.string().optional(),
});

export type ExplorerSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): ExplorerSearch => {
    // Coerce potential string parameters into array if single item was passed in query
    const coerceArray = (val: unknown): string[] | undefined => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map(String);
      return [String(val)];
    };

    return {
      benchmark: typeof search.benchmark === "string" ? search.benchmark : undefined,
      models: coerceArray(search.models),
      harnesses: coerceArray(search.harnesses),
      efforts: coerceArray(search.efforts),
      costBasis: search.costBasis === "today" ? "today" : "reported",
      pinned: typeof search.pinned === "string" ? search.pinned : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps: { search } }) => {
    return await getExplorerData({
      data: {
        benchmarkVersionId: search.benchmark,
        models: search.models,
        harnesses: search.harnesses,
        efforts: search.efforts,
        costBasis: search.costBasis ?? "reported",
      },
    });
  },
  component: ExplorerPage,
});

function ExplorerPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const selectedBenchmarkId =
    search.benchmark || (data.currentBenchmark ? data.currentBenchmark.id : undefined);
  const selectedModels = search.models ?? [];
  const selectedHarnesses = search.harnesses ?? [];
  const selectedEfforts = search.efforts ?? [];
  const costBasis = search.costBasis ?? "reported";
  const pinnedId = search.pinned ?? null;

  // Search param updaters
  const updateSearch = (updater: (prev: ExplorerSearch) => ExplorerSearch) => {
    navigate({
      search: (prev: ExplorerSearch) => updater(prev),
      replace: true,
    });
  };

  const handleSelectBenchmark = (id: string) => {
    updateSearch((prev) => ({
      ...prev,
      benchmark: id,
      pinned: undefined, // clear pinned when changing benchmark
    }));
  };

  const handleToggleModel = (slug: string) => {
    updateSearch((prev) => {
      const current = prev.models ?? [];
      const updated = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      return {
        ...prev,
        models: updated.length > 0 ? updated : undefined,
      };
    });
  };

  const handleToggleHarness = (slug: string) => {
    updateSearch((prev) => {
      const current = prev.harnesses ?? [];
      const updated = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      return {
        ...prev,
        harnesses: updated.length > 0 ? updated : undefined,
      };
    });
  };

  const handleToggleEffort = (slug: string) => {
    updateSearch((prev) => {
      const current = prev.efforts ?? [];
      const updated = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      return {
        ...prev,
        efforts: updated.length > 0 ? updated : undefined,
      };
    });
  };

  const handleChangeCostBasis = (basis: "reported" | "today") => {
    updateSearch((prev) => ({
      ...prev,
      costBasis: basis,
    }));
  };

  const handleSelectPin = (id: string | null) => {
    updateSearch((prev) => ({
      ...prev,
      pinned: id ?? undefined,
    }));
  };

  const handleResetFilters = () => {
    updateSearch((prev) => ({
      benchmark: prev.benchmark,
      costBasis: prev.costBasis,
      pinned: undefined,
    }));
  };

  const hasActiveFilters =
    selectedModels.length > 0 ||
    selectedHarnesses.length > 0 ||
    selectedEfforts.length > 0 ||
    pinnedId !== null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* Compiled leaderboards notice banner */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 text-xs flex items-center justify-between gap-4 text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">INFO:</span>
          <span>
            Numbers are compiled from public leaderboards &amp; seed fixtures. Illustrative eval runs only, not an official leaderboard.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <span>TB task text excluded</span>
          <span>&bull;</span>
          <span>Single-benchmark isolation active</span>
        </div>
      </div>

      {/* Main Content: Filter Rail + Visualization + Table */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Filter Rail */}
        <FilterRail
          benchmarks={data.benchmarkOptions}
          selectedBenchmarkId={selectedBenchmarkId}
          onSelectBenchmark={handleSelectBenchmark}
          models={data.availableModels}
          selectedModels={selectedModels}
          onToggleModel={handleToggleModel}
          harnesses={data.availableHarnesses}
          selectedHarnesses={selectedHarnesses}
          onToggleHarness={handleToggleHarness}
          efforts={data.availableEfforts}
          selectedEfforts={selectedEfforts}
          onToggleEffort={handleToggleEffort}
          costBasis={costBasis}
          onChangeCostBasis={handleChangeCostBasis}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Right Dashboard Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto min-h-0">
          {/* Top Status & Focal Moment Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">
                Benchmark
              </span>
              <span className="text-sm font-bold text-zinc-100 truncate">
                {data.currentBenchmark?.benchmarkName ?? "None"}
              </span>
              <span className="text-[10px] text-zinc-400">
                v{data.currentBenchmark?.version} ({data.currentBenchmark?.nTasks} tasks)
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">
                Visible Runs
              </span>
              <span className="text-sm font-bold text-zinc-100">
                {data.allRuns.length}
              </span>
              <span className="text-[10px] text-zinc-400">
                {data.frontier.length} on Pareto frontier
              </span>
            </div>

            <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">
                Cost Basis
              </span>
              <span className="text-sm font-bold text-emerald-400 uppercase">
                {costBasis}
              </span>
              <span className="text-[10px] text-zinc-400">
                USD / task denominator = {data.currentBenchmark?.nTasks ?? 66}
              </span>
            </div>

            {/* Focal Moment: The Knee */}
            <div className="bg-cyan-950/20 border border-cyan-500/40 rounded p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-cyan-400 font-bold tracking-wider">
                  ⚡ Efficiency Knee
                </span>
                <span className="text-[9px] px-1 rounded bg-cyan-900/60 text-cyan-300">
                  Best trade-off
                </span>
              </div>
              <span className="text-sm font-bold text-zinc-100 truncate">
                {data.kneePoint ? data.kneePoint.modelDisplayName : "N/A"}
              </span>
              <span className="text-[10px] text-cyan-300">
                {data.kneePoint
                  ? `${data.kneePoint.solveRate.toFixed(1)}% @ $${(data.kneePoint.cost ?? 0).toFixed(2)}/task`
                  : "No undominated knee"}
              </span>
            </div>
          </div>

          {/* D1 Error banner if database had issues */}
          {data.error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
              <strong>Database Notice:</strong> {data.error}
            </div>
          )}

          {/* ECharts Pareto Scatter Plot */}
          <ParetoChart
            runs={data.allRuns}
            frontier={data.frontier}
            kneePoint={data.kneePoint}
            pinnedId={pinnedId}
            hoveredId={hoveredId}
            onSelectPin={handleSelectPin}
            onHoverPoint={setHoveredId}
            costBasis={costBasis}
          />

          {/* TanStack Table of Visible Configurations */}
          <DataTable
            data={data.allRuns}
            pinnedId={pinnedId}
            hoveredId={hoveredId}
            onSelectPin={handleSelectPin}
            onHoverRow={setHoveredId}
            costBasis={costBasis}
          />
        </div>
      </div>
    </div>
  );
}

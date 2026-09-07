import { createFileRoute, useNavigate, useNavigate as useNav, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import { Zap, Columns3 } from "lucide-react";
import { getExplorerData } from "../server/functions";
import { ParetoChart } from "../components/ParetoChart";
import { PassAtKChart, EffortChart, ResourceChart } from "../components/ChartSlots";
import { DataTable } from "../components/DataTable";
import { FilterRail, type EffortMatch, benchLabel } from "../components/FilterRail";
import { IngestHealthStrip } from "../components/IngestHealthStrip";
import type { ExplorerRun } from "../server/functions";

const searchSchema = z.object({
  benchmark: z.string().optional(),
  models: z.array(z.string()).optional(),
  harnesses: z.array(z.string()).optional(),
  efforts: z.array(z.string()).optional(),
  costBasis: z.enum(["reported", "today"]).optional(),
  pinned: z.string().optional(),
  chart: z.enum(["pareto", "passk", "effort", "resources"]).optional(),
  effortMatch: z.enum(["all", "max", "xhigh"]).optional(),
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
    // Numeric-looking params arrive parsed as numbers — coerce back to string.
    const coerceString = (v: unknown): string | undefined =>
      v === undefined || v === null ? undefined : String(v);

    return {
      benchmark: coerceString(search.benchmark),
      models: coerceArray(search.models),
      harnesses: coerceArray(search.harnesses),
      efforts: coerceArray(search.efforts),
      costBasis: search.costBasis === "today" ? "today" : "reported",
      pinned: coerceString(search.pinned),
      chart:
        search.chart === "passk" || search.chart === "effort" || search.chart === "resources"
          ? search.chart
          : search.chart === "pareto"
            ? "pareto"
            : undefined,
      effortMatch:
        search.effortMatch === "max" || search.effortMatch === "xhigh"
          ? search.effortMatch
          : undefined,
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
        effortMatch:
          search.effortMatch === "max" || search.effortMatch === "xhigh"
            ? search.effortMatch
            : "all",
      },
    });
  },
  component: ExplorerPage,
});

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded px-2.5 py-2 flex flex-col justify-between gap-0.5">
      <span className="text-[11px] uppercase text-zinc-500 font-semibold tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}

function KneeNextStep({ frontier, knee }: { frontier: ExplorerRun[]; knee: ExplorerRun | null }) {
  if (!knee || frontier.length < 2) return null;
  const sorted = [...frontier]
    .filter((r) => r.cost !== null && r.cost > 0)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  const idx = sorted.findIndex((r) => r.id === knee.id);
  if (idx < 0 || idx >= sorted.length - 1) {
    return (
      <span className="text-[11px] text-zinc-500">
        Top of frontier — no cheaper/better step above.
      </span>
    );
  }
  const next = sorted[idx + 1];
  const dCost = (next.cost ?? 0) - (knee.cost ?? 0);
  const dSolve = next.solveRate - knee.solveRate;
  return (
    <span className="text-[11px] text-zinc-400">
      Next frontier step:{" "}
      <span className="text-zinc-200 font-mono">
        +${dCost.toFixed(2)}/task → +{dSolve.toFixed(1)} pts
      </span>{" "}
      ({next.modelDisplayName})
    </span>
  );
}

function ChartSlotTabs({
  active,
  onSelect,
  hasPassAtK,
  hasEffortPairs,
  hasResources,
}: {
  active: "pareto" | "passk" | "effort" | "resources";
  onSelect: (slot: "pareto" | "passk" | "effort" | "resources") => void;
  hasPassAtK: boolean;
  hasEffortPairs: boolean;
  hasResources: boolean;
}) {
  const tabs: Array<{
    id: "pareto" | "passk" | "effort" | "resources";
    label: string;
    ready: boolean;
    title: string;
  }> = [
    { id: "pareto", label: "Pareto", ready: true, title: "Cost vs solve rate frontier" },
    {
      id: "passk",
      label: "Pass@k",
      ready: hasPassAtK,
      title: hasPassAtK ? "k vs cumulative solve rate" : "Needs pass@k telemetry — none in this slice",
    },
    {
      id: "effort",
      label: "Effort",
      ready: hasEffortPairs,
      title: hasEffortPairs
        ? "Solve rate across effort presets"
        : "Needs a model+harness pair at 2+ efforts — none in this slice",
    },
    {
      id: "resources",
      label: "Resources",
      ready: hasResources,
      title: hasResources
        ? "USD, tokens, wall-clock multipliers vs the cheapest costed baseline"
        : "Needs at least two costed configurations — none in this slice",
    },
  ];
  return (
    <div className="flex items-center gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title}
          onClick={() => onSelect(t.id)}
          className={`px-2.5 py-1 rounded text-[11px] transition-colors inline-flex items-center gap-1.5 ${
            active === t.id
              ? "bg-zinc-800 text-emerald-400 font-semibold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          {t.label}
          {!t.ready && <span className="text-[8px] uppercase text-zinc-600 border border-zinc-800 rounded px-0.5">empty</span>}
        </button>
      ))}
    </div>
  );
}

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
  const pinnedIds = React.useMemo(
    () => (search.pinned ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [search.pinned]
  );
  const chartSlot = search.chart ?? "pareto";

  const navigateToDossier = useNav();

  // Search param updaters — the URL is the single source of truth for filters.
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
      pinned: undefined, // pinned run belongs to one benchmark version only
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
    if (id === null) return;
    updateSearch((prev) => {
      // Multi-pin: the param is a comma-separated set; clicking toggles membership.
      const current = (prev.pinned ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const next = current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id].slice(-8); // compare matrix caps at 8
      return {
        ...prev,
        pinned: next.length > 0 ? next.join(",") : undefined,
      };
    });
  };

  const handleSelectChart = (slot: "pareto" | "passk" | "effort" | "resources") => {
    updateSearch((prev) => ({
      ...prev,
      chart: slot === "pareto" ? undefined : slot, // pareto is the default → keep URLs clean
    }));
  };

  const handleResetFilters = () => {
    updateSearch((prev) => ({
      benchmark: prev.benchmark,
      costBasis: prev.costBasis,
      pinned: undefined,
      effortMatch: undefined,
    }));
  };

  const handleEffortMatchChange = (m: EffortMatch) => {
    updateSearch((prev) => ({
      ...prev,
      effortMatch: m === "all" ? undefined : m,
    }));
  };

  const hasActiveFilters =
    selectedModels.length > 0 ||
    selectedHarnesses.length > 0 ||
    selectedEfforts.length > 0 ||
    pinnedIds.length > 0;

  const plottedRuns = data.allRuns.filter((r) => r.hasCost && r.cost !== null && r.cost > 0);
  const knee = data.kneePoint;
  const passKReady = data.allRuns.some((r) => r.hasPassAtK);
  const effortPairCount = (() => {
    const m = new Map<string, Set<string>>();
    for (const r of data.allRuns) {
      const key = `${r.modelSlug}|${r.harnessId}`;
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(r.effortPresetSlug);
    }
    return Array.from(m.values()).filter((s) => s.size >= 2).length;
  })();
  const costedCount = data.allRuns.filter((r) => r.hasCost && r.cost !== null && r.cost > 0).length;
  // Seed banner only on slices that actually contain compiled/seed rows (Phase 4
  // acceptance). All-official slices get a lighter ingest note instead.
  const seedRows = data.allRuns.filter((r) => !r.sourceOfficial).length;
  const officialRows = data.allRuns.length - seedRows;
  const sliceIsPureSeedMix = seedRows > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* Composition-aware notice banner: seed disclaimer only on seed-containing slices */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-1.5 text-[11px] flex items-center justify-between gap-4 text-zinc-400">
        <div className="flex items-center gap-2">
          {sliceIsPureSeedMix ? (
            <>
              <span className="text-amber-400 font-bold tracking-wide">NOTE</span>
              <span>
                Numbers are compiled from public leaderboards &amp; seed fixtures — illustrative
                eval runs, <span className="text-zinc-200">not an official leaderboard</span>.
              </span>
            </>
          ) : (
            <>
              <span className="text-emerald-400 font-bold tracking-wide">SOURCE</span>
              <span>
                {data.allRuns.length} runs ingested from official leaderboards —{" "}
                <span className="text-zinc-200">aggregates only</span>, not an independent
                evaluation.
              </span>
            </>
          )}
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          {seedRows > 0 && (
            <>
              <span>{seedRows} compiled</span>
              <span>&bull;</span>
            </>
          )}
          {officialRows > 0 && (
            <>
              <span>{officialRows} official</span>
              <span>&bull;</span>
            </>
          )}
          <span>no benchmark task text stored</span>
          <span>&bull;</span>
          <a href="/methodology" className="underline hover:text-zinc-300">
            methodology
          </a>
        </div>
      </div>

      <IngestHealthStrip />

      {/* Main Content: Filter Rail + Chart + Table */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
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
          effortMatch={(search.effortMatch ?? "all") as EffortMatch}
          onEffortMatchChange={handleEffortMatchChange}
          costBasis={costBasis}
          onChangeCostBasis={handleChangeCostBasis}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto min-h-0">
          {/* Status strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatTile label="Benchmark">
              <span className="text-sm font-bold text-zinc-100 truncate">
                {data.currentBenchmark?.benchmarkName ?? "None"}
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                v{data.currentBenchmark?.version} · {data.currentBenchmark?.nTasks} tasks
              </span>
            </StatTile>

            <StatTile label="Configurations">
              <span className="text-sm font-bold text-zinc-100 font-mono">
                {data.allRuns.length}
                <span className="text-[11px] text-zinc-500 font-normal"> visible</span>
              </span>
              <span className="text-[11px] text-zinc-300">
                {data.frontier.length} on frontier · {plottedRuns.length} plotted
              </span>
            </StatTile>

            <StatTile label="Cost basis">
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                {costBasis}
              </span>
              <span className="text-[11px] text-zinc-400">
                $/task = total ÷ {data.currentBenchmark?.nTasks ?? "n_tasks"}
              </span>
            </StatTile>

            {/* Knee callout: where diminishing returns set in */}
            <div
              className={`bg-cyan-950/20 border rounded px-2.5 py-2 flex flex-col justify-between gap-0.5 ${
                knee ? "border-cyan-500/40" : "border-zinc-800/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] uppercase text-cyan-400 font-bold tracking-wider">
                  <Zap size={10} />
                  Efficiency knee
                </span>
                <span className="text-[11px] px-1 rounded bg-cyan-900/60 text-cyan-300">
                  best trade-off
                </span>
              </div>
              {knee ? (
                <>
                  <span className="text-sm font-bold text-zinc-100 truncate">{knee.modelDisplayName}</span>
                  <span className="text-[11px] text-cyan-300 font-mono">
                    {knee.harnessName} · {knee.effortPresetSlug} · {knee.solveRate.toFixed(1)}% @ $
                    {(knee.cost ?? 0).toFixed(2)}/task
                  </span>
                  <KneeNextStep frontier={data.frontier} knee={knee} />
                </>
              ) : (
                <span className="text-[11px] text-zinc-500">No undominated knee in this slice.</span>
              )}
            </div>
          </div>

          {/* D1 Error banner if database had issues */}
          {data.error && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 px-3 py-2 rounded text-xs">
              <strong>Database notice:</strong> {data.error}
            </div>
          )}

          {/* Chart slot switcher — Pareto default; slots are coverage-gated */}
          <div className="flex items-center justify-between gap-3">
            <ChartSlotTabs
              active={chartSlot}
              onSelect={handleSelectChart}
              hasPassAtK={passKReady}
              hasEffortPairs={effortPairCount > 0}
              hasResources={costedCount >= 2}
            />
            <div className="flex items-center gap-3">
              {pinnedIds.length > 0 && (
                <Link
                  to="/compare"
                  search={{
                    ids: pinnedIds.join(","),
                    benchmark: selectedBenchmarkId || undefined,
                    costBasis: costBasis === "today" ? "today" : undefined,
                  }}
                  className="px-2.5 py-1 rounded text-[11px] bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/60 transition-colors inline-flex items-center gap-1.5"
                >
                  <Columns3 size={11} />
                  Compare pins ({pinnedIds.length})
                </Link>
              )}
              <span className="text-[11px] text-zinc-600 font-mono">
                slot: {chartSlot}
                {chartSlot !== "pareto" ? ` (?chart=${chartSlot})` : ""}
              </span>
            </div>
          </div>

          {chartSlot === "pareto" && (
            <ParetoChart
              runs={data.allRuns}
              frontier={data.frontier}
              kneePoint={knee}
              pinnedIds={pinnedIds}
              hoveredId={hoveredId}
              onSelectPin={handleSelectPin}
              onHoverPoint={setHoveredId}
              onOpenDossier={(id) =>
                navigateToDossier({
                  to: "/runs/$id",
                  params: { id },
                  search: { pins: pinnedIds.length > 0 ? pinnedIds.join(",") : undefined },
                })
              }
              costBasis={costBasis}
            />
          )}
          {chartSlot === "passk" && <PassAtKChart runs={data.allRuns} />}
          {chartSlot === "effort" && <EffortChart runs={data.allRuns} />}
          {chartSlot === "resources" && <ResourceChart runs={data.allRuns} />}

          {/* Configurations table */}
          <DataTable
            data={data.allRuns}
            pinnedIds={pinnedIds}
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

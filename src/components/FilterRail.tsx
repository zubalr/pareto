import * as React from "react";
import { Boxes, CircleDollarSign, Cpu, RotateCcw, SquareTerminal, Gauge, Search, X } from "lucide-react";
import type {
  BenchmarkOption,
  FilterOption,
} from "../server/functions";

export type EffortMatch = "all" | "max" | "xhigh";

interface FilterRailProps {
  benchmarks: BenchmarkOption[];
  selectedBenchmarkId: string | undefined;
  onSelectBenchmark: (id: string) => void;

  models: FilterOption[];
  selectedModels: string[];
  onToggleModel: (slug: string) => void;

  harnesses: FilterOption[];
  selectedHarnesses: string[];
  onToggleHarness: (slug: string) => void;

  efforts: FilterOption[];
  selectedEfforts: string[];
  onToggleEffort: (slug: string) => void;

  effortMatch: EffortMatch;
  onEffortMatchChange: (m: EffortMatch) => void;

  costBasis: "reported" | "today";
  onChangeCostBasis: (basis: "reported" | "today") => void;

  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

/** Human benchmark label: never a doubled version, tasks count after a middot. */
export function benchLabel(b: BenchmarkOption): string {
  const name = b.benchmarkName.trim();
  const version = b.version.trim();
  const withVersion = name.toLowerCase().includes(version.toLowerCase())
    ? name
    : version.toLowerCase() === "none" || version === ""
      ? name
      : `${name} ${version}`;
  return `${withVersion} · ${b.nTasks} tasks`;
}

function SectionHeader({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
        <span className="text-zinc-400">{icon}</span>
        {label}
      </label>
      {hint && <span className="text-[11px] text-zinc-400 font-mono">{hint}</span>}
    </div>
  );
}

interface ChipListSectionProps {
  icon: React.ReactNode;
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  upperCaseOptions?: boolean;
}

/**
 * Search + chip filter: a search box finds options without scrolling (frontier
 * models are never hidden behind an overflow), selected options render as
 * removable chips, and the checkbox list shows the search-filtered remainder.
 * Empty selection = all configurations with data.
 */
function ChipListSection({
  icon,
  label,
  options,
  selected,
  onToggle,
  upperCaseOptions,
}: ChipListSectionProps) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const selectedOptions = options.filter((o) => selected.includes(o.slug));

  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader
        icon={icon}
        label={label}
        hint={selected.length === 0 ? "all" : `${selected.length}/${options.length}`}
      />
      {options.length > 6 && (
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            id={label === "Models" ? "model-search" : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-label={`Search ${label.toLowerCase()}`}
            title={label === "Models" ? "Press / to search" : undefined}
            className="w-full bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded px-2 py-1 pl-6 text-xs focus:outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/60 placeholder:text-zinc-500"
          />
        </div>
      )}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((o) => (
            <button
              key={o.slug}
              type="button"
              onClick={() => onToggle(o.slug)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono hover:bg-emerald-950/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              title="Click to remove"
            >
              {upperCaseOptions ? o.name.toUpperCase() : o.name}
              <X size={9} />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto pr-1">
        {visible.map((o) => {
          const isChecked = selected.includes(o.slug);
          return (
            <label
              key={o.slug}
              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-200 text-xs"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(o.slug)}
                className="rounded accent-emerald-500 focus:ring-2 focus:ring-emerald-500/40 h-4 w-4 cursor-pointer"
              />
              <span className={upperCaseOptions ? "uppercase font-mono" : "truncate"}>
                {o.name}
              </span>
            </label>
          );
        })}
        {visible.length === 0 && (
          <span className="text-[11px] text-zinc-500 px-1.5 py-1">No matches — clear the search.</span>
        )}
      </div>
    </div>
  );
}

export function FilterRail({
  benchmarks,
  selectedBenchmarkId,
  onSelectBenchmark,
  models,
  selectedModels,
  onToggleModel,
  harnesses,
  selectedHarnesses,
  onToggleHarness,
  efforts,
  selectedEfforts,
  onToggleEffort,
  effortMatch,
  onEffortMatchChange,
  costBasis,
  onChangeCostBasis,
  onResetFilters,
  hasActiveFilters,
}: FilterRailProps) {
  const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId);

  return (
    <aside className="w-full lg:w-64 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800/80 p-3.5 flex flex-col gap-5 overflow-y-auto text-xs shrink-0">
      {/* Benchmark Selector — required, single-choice, coordinates the whole board */}
      <div className="flex flex-col gap-1.5">
        <SectionHeader icon={<Boxes size={12} />} label="Benchmark" hint="required" />
        <select
          value={selectedBenchmarkId}
          onChange={(e) => onSelectBenchmark(e.target.value)}
          aria-label="Benchmark version (required, single choice)"
          className="w-full bg-zinc-900 border border-emerald-500/40 hover:border-emerald-500/70 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
        >
          {benchmarks.map((b) => (
            <option key={b.id} value={b.id}>
              {benchLabel(b)}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-zinc-400 leading-snug">
          One benchmark per board — points from different versions never share a chart.
        </p>
      </div>

      {/* Cost Basis Toggle */}
      <div className="flex flex-col gap-1.5">
        <SectionHeader icon={<CircleDollarSign size={12} />} label="Cost basis" />
        <div className="grid grid-cols-2 p-0.5 bg-zinc-900 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => onChangeCostBasis("reported")}
            aria-pressed={costBasis === "reported"}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              costBasis === "reported"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:text-zinc-100"
            }`}
          >
            Reported
          </button>
          <button
            type="button"
            onClick={() => onChangeCostBasis("today")}
            aria-pressed={costBasis === "today"}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              costBasis === "today"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:text-zinc-100"
            }`}
          >
            Today
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 leading-snug">
          Reported = priced at original eval time. Today = re-priced at current list
          rates; runs without restated pricing are omitted.
        </p>
      </div>

      {/* Effort matching — global constraint applied before frontier math */}
      <div className="flex flex-col gap-1.5">
        <SectionHeader icon={<Gauge size={12} />} label="Match effort" />
        <div className="grid grid-cols-3 p-0.5 bg-zinc-900 rounded border border-zinc-800">
          {(["all", "max", "xhigh"] as EffortMatch[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onEffortMatchChange(m)}
              aria-pressed={effortMatch === m}
              className={`px-1 py-1 text-xs rounded transition-colors uppercase font-mono ${
                effortMatch === m
                  ? "bg-zinc-800 text-emerald-400 font-semibold"
                  : "text-zinc-300 hover:text-zinc-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 leading-snug">
          {effortMatch === "all"
            ? "All effort presets included."
            : `Only ${effortMatch}-effort runs are ranked — configs without that preset are omitted, not faked.`}
        </p>
      </div>

      {/* Multi-selects: search + chips */}
      <ChipListSection
        icon={<Cpu size={12} />}
        label="Models"
        options={models}
        selected={selectedModels}
        onToggle={onToggleModel}
      />
      <ChipListSection
        icon={<SquareTerminal size={12} />}
        label="Harnesses"
        options={harnesses}
        selected={selectedHarnesses}
        onToggle={onToggleHarness}
      />
      <ChipListSection
        icon={<Gauge size={12} />}
        label="Efforts"
        options={efforts}
        selected={selectedEfforts}
        onToggle={onToggleEffort}
        upperCaseOptions
      />

      {/* Empty-select semantics + reset */}
      <p className="text-[11px] text-zinc-500 leading-snug">
        Empty multi-select = all configurations with data.
        {selectedBenchmark ? ` Denominator: ${selectedBenchmark.nTasks} tasks.` : ""}
      </p>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded text-xs transition-colors mt-auto font-medium inline-flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={11} />
          Reset filters
        </button>
      )}
    </aside>
  );
}

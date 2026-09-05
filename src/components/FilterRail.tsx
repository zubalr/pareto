import React from "react";
import type {
  BenchmarkOption,
  FilterOption,
} from "../server/functions";

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

  costBasis: "reported" | "today";
  onChangeCostBasis: (basis: "reported" | "today") => void;

  onResetFilters: () => void;
  hasActiveFilters: boolean;
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
  costBasis,
  onChangeCostBasis,
  onResetFilters,
  hasActiveFilters,
}: FilterRailProps) {
  return (
    <aside className="w-full lg:w-64 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800/80 p-3.5 flex flex-col gap-5 overflow-y-auto text-xs shrink-0">
      {/* Benchmark Selector (Required, Single) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
          <span>Benchmark</span>
          <span className="text-[9px] text-zinc-500 font-normal">Single choice</span>
        </label>
        <select
          value={selectedBenchmarkId}
          onChange={(e) => onSelectBenchmark(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700/80 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono"
        >
          {benchmarks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Cost Basis Toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Cost Basis
        </label>
        <div className="grid grid-cols-2 p-0.5 bg-zinc-900 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => onChangeCostBasis("reported")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              costBasis === "reported"
                ? "bg-zinc-800 text-emerald-400 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Reported
          </button>
          <button
            type="button"
            onClick={() => onChangeCostBasis("today")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              costBasis === "today"
                ? "bg-zinc-800 text-emerald-400 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Today
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 leading-tight">
          Reported matches original eval runs. Today reflects normalized pricing.
        </p>
      </div>

      {/* Models Filter (Multi-select) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Models
          </label>
          <span className="text-[10px] text-zinc-500">
            {selectedModels.length === 0 ? "All" : `${selectedModels.length} selected`}
          </span>
        </div>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
          {models.map((m) => {
            const isChecked = selectedModels.includes(m.slug);
            return (
              <label
                key={m.slug}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleModel(m.slug)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                />
                <span className="truncate">{m.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Harnesses Filter (Multi-select) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Harnesses
          </label>
          <span className="text-[10px] text-zinc-500">
            {selectedHarnesses.length === 0 ? "All" : `${selectedHarnesses.length} selected`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {harnesses.map((h) => {
            const isChecked = selectedHarnesses.includes(h.slug);
            return (
              <label
                key={h.slug}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleHarness(h.slug)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                />
                <span className="truncate">{h.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Effort Presets Filter (Multi-select) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Effort Presets
          </label>
          <span className="text-[10px] text-zinc-500">
            {selectedEfforts.length === 0 ? "All" : `${selectedEfforts.length} selected`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {efforts.map((e) => {
            const isChecked = selectedEfforts.includes(e.slug);
            return (
              <label
                key={e.slug}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleEffort(e.slug)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                />
                <span className="uppercase font-mono">{e.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Filter Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs transition-colors mt-auto font-medium"
        >
          Reset Filters
        </button>
      )}
    </aside>
  );
}

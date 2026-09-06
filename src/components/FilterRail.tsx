import React from "react";
import { Boxes, CircleDollarSign, Cpu, RotateCcw, SquareTerminal, Gauge } from "lucide-react";
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
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="text-zinc-500">{icon}</span>
        {label}
      </label>
      {hint && <span className="text-[9px] text-zinc-500 font-mono">{hint}</span>}
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
  costBasis,
  onChangeCostBasis,
  onResetFilters,
  hasActiveFilters,
}: FilterRailProps) {
  const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId);

  return (
    <aside className="w-full lg:w-60 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800/80 p-3.5 flex flex-col gap-5 overflow-y-auto text-xs shrink-0">
      {/* Benchmark Selector — required, single-choice, coordinates the whole board */}
      <div className="flex flex-col gap-1.5">
        <SectionHeader
          icon={<Boxes size={12} />}
          label="Benchmark"
          hint="required"
        />
        <select
          value={selectedBenchmarkId}
          onChange={(e) => onSelectBenchmark(e.target.value)}
          aria-label="Benchmark version (required, single choice)"
          className="w-full bg-zinc-900 border border-emerald-500/40 hover:border-emerald-500/70 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
        >
          {benchmarks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayLabel}
            </option>
          ))}
        </select>
        <p className="text-[9px] text-zinc-500 leading-snug">
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
            className={`px-2 py-1 text-xs rounded transition-colors ${
              costBasis === "reported"
                ? "bg-zinc-800 text-emerald-400 font-semibold"
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
                ? "bg-zinc-800 text-emerald-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Today
          </button>
        </div>
        <p className="text-[9px] text-zinc-500 leading-snug">
          Reported = priced at original eval time. Today = re-priced at current list rates.
        </p>
      </div>

      {/* Models Filter (Multi-select) */}
      <div className="flex flex-col gap-1.5">
        <SectionHeader
          icon={<Cpu size={12} />}
          label="Models"
          hint={selectedModels.length === 0 ? "all" : `${selectedModels.length}/${models.length}`}
        />
        <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto pr-1">
          {models.map((m) => {
            const isChecked = selectedModels.includes(m.slug);
            return (
              <label
                key={m.slug}
                className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
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
        <SectionHeader
          icon={<SquareTerminal size={12} />}
          label="Harnesses"
          hint={
            selectedHarnesses.length === 0 ? "all" : `${selectedHarnesses.length}/${harnesses.length}`
          }
        />
        <div className="flex flex-col gap-0.5">
          {harnesses.map((h) => {
            const isChecked = selectedHarnesses.includes(h.slug);
            return (
              <label
                key={h.slug}
                className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
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
        <SectionHeader
          icon={<Gauge size={12} />}
          label="Effort"
          hint={selectedEfforts.length === 0 ? "all" : `${selectedEfforts.length}/${efforts.length}`}
        />
        <div className="flex flex-col gap-0.5">
          {efforts.map((e) => {
            const isChecked = selectedEfforts.includes(e.slug);
            return (
              <label
                key={e.slug}
                className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-900/80 cursor-pointer select-none text-zinc-300 text-[11px]"
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

      {/* Empty-select semantics + reset */}
      <p className="text-[9px] text-zinc-600 leading-snug">
        Empty multi-select = all configurations with data.
        {selectedBenchmark ? ` Denominator: ${selectedBenchmark.nTasks} tasks.` : ""}
      </p>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs transition-colors mt-auto font-medium inline-flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={11} />
          Reset filters
        </button>
      )}
    </aside>
  );
}

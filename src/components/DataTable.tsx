import React from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Pin } from "lucide-react";
import type { ExplorerRun } from "../server/functions";

interface DataTableProps {
  data: ExplorerRun[];
  pinnedIds: string[];
  hoveredId: string | null;
  onSelectPin: (id: string | null) => void;
  onHoverRow: (id: string | null) => void;
  costBasis: "reported" | "today";
}

const columnHelper = createColumnHelper<ExplorerRun>();

// Solid row backgrounds so the sticky config column can scroll over siblings
// without transparency bleed (see DESIGN.md §Table).
const ROW_BG = {
  base: "bg-zinc-950",
  hover: "bg-zinc-900",
  pinned: "bg-[#221804]",
  knee: "bg-[#0c1a1e]",
} as const;

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

export function DataTable({
  data,
  pinnedIds,
  hoveredId,
  onSelectPin,
  onHoverRow,
  costBasis,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "solveRate", desc: true },
  ]);

  const columns = React.useMemo(
    () => [
      columnHelper.accessor(
        (r) => (r.isKnee ? 2 : r.isFrontier ? 1 : 0),
        {
          id: "status",
          header: "Status",
          cell: (info) => <StatusBadge run={info.row.original} />,
        }
      ),

      // Pinned configuration column: the full run grain at a glance.
      columnHelper.display({
        id: "config",
        header: "Configuration",
        cell: (info) => {
          const run = info.row.original;
          const isPinned = pinnedIds.includes(run.id);
          return (
            <div className="min-w-[190px]">
              <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                <span className="truncate">{run.modelDisplayName}</span>
                {isPinned && (
                  <Pin size={11} className="text-amber-400 shrink-0" aria-label="Pinned" />
                )}
              </div>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                <span>{run.harnessName}</span>
                <span className="text-zinc-700">/</span>
                <span className="px-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase font-mono">
                  {run.effortPresetSlug}
                </span>
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("solveRate", {
        header: "Solve rate",
        cell: (info) => {
          const run = info.row.original;
          const val = info.getValue();
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100">{val.toFixed(1)}%</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {run.nSolved}/{run.nTotal}
                </span>
              </div>
              <div className="w-20 bg-zinc-900 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className={`${run.isFrontier ? "bg-emerald-500" : "bg-zinc-600"} h-full rounded-full`}
                  style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                />
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor(
        (r) => (costBasis === "today" ? r.costPerTaskNormalized : r.costPerTaskReported),
        {
          id: "costPerTask",
          header: costBasis === "today" ? "$/task (today)" : "$/task (reported)",
          cell: (info) => {
            const val = info.getValue();
            if (val === null || val === undefined) {
              return <span className="text-zinc-600" title="No cost telemetry">—</span>;
            }
            return <span className="font-semibold text-zinc-200">${val.toFixed(2)}</span>;
          },
        }
      ),

      columnHelper.accessor(
        (r) =>
          r.costUsdReported !== null &&
          r.costUsdReported !== undefined &&
          r.nSolved > 0
            ? r.costUsdReported / r.nSolved
            : null,
        {
          id: "costPerResolved",
          header: "$/resolved",
          cell: (info) => {
            const run = info.row.original;
            const val = info.getValue();
            if (val === null || val === undefined) {
              return <span className="text-zinc-600" title="Total cost ÷ resolved tasks (unavailable)">—</span>;
            }
            return (
              <span
                className="text-zinc-300 font-mono"
                title={`$${run.costUsdReported?.toFixed(0)} total ÷ ${run.nSolved} resolved`}
              >
                ${val.toFixed(2)}
              </span>
            );
          },
        }
      ),

      columnHelper.accessor("costUsdReported", {
        header: "Total $",
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined) {
            return <span className="text-zinc-600">—</span>;
          }
          return <span className="text-zinc-400 font-mono">${val.toFixed(0)}</span>;
        },
      }),

      columnHelper.display({
        id: "telemetry",
        header: "Coverage",
        cell: (info) => <CoverageChips run={info.row.original} />,
      }),

      columnHelper.display({
        id: "source",
        header: "Source",
        cell: (info) => {
          const run = info.row.original;
          return (
            <span
              className={`text-[10px] ${run.sourceOfficial ? "text-emerald-500/80" : "text-zinc-500"}`}
              title={run.sourceOfficial ? "Official source" : "Compiled / unofficial source"}
            >
              {run.sourceName}
              {run.sourceOfficial ? " ●" : " ○"}
            </span>
          );
        },
      }),
    ],
    [pinnedIds, costBasis]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowBg = (run: ExplorerRun, isPinned: boolean, isHovered: boolean): string => {
    if (isPinned) return ROW_BG.pinned;
    if (isHovered) return ROW_BG.hover;
    if (run.isKnee) return ROW_BG.knee;
    return ROW_BG.base;
  };

  return (
    <div className="w-full bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden flex flex-col">
      <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="font-semibold uppercase tracking-wider">Configurations</span>
          <span className="text-zinc-600">|</span>
          <span className="font-mono">
            {data.length} visible · {data.filter((r) => r.isFrontier).length} on frontier
          </span>
        </div>
        <div className="text-zinc-500 text-[10px]">
          Hover row to highlight on chart · click row to pin
        </div>
      </div>

      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-zinc-900 sticky top-0 z-10 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isConfig = header.column.id === "config";
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-semibold select-none ${
                        isConfig
                          ? "sticky left-0 z-20 bg-zinc-900 border-r border-zinc-800/60"
                          : "bg-zinc-900"
                      } ${header.column.getCanSort() ? "cursor-pointer hover:text-zinc-300 transition-colors" : ""}`}
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: " ▲",
                          desc: " ▼",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {table.getRowModel().rows.map((row) => {
              const run = row.original;
              const isPinned = pinnedIds.includes(run.id);
              const isHovered = hoveredId === run.id;
              const bg = rowBg(run, isPinned, isHovered);

              return (
                <tr
                  key={row.id}
                  className={`${bg} transition-colors cursor-pointer ${
                    isPinned ? "border-l-2 border-l-amber-500" : ""
                  }`}
                  onClick={() => onSelectPin(run.id)}
                  onMouseEnter={() => onHoverRow(run.id)}
                  onMouseLeave={() => onHoverRow(null)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isConfig = cell.column.id === "config";
                    return (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 whitespace-nowrap ${isConfig ? "sticky left-0 border-r border-zinc-800/60" : ""}`}
                        style={isConfig ? { background: "inherit" } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr className={ROW_BG.base}>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  No configurations match the current filters. Empty multi-selects mean "all with
                  data" — clear a filter to widen the slice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

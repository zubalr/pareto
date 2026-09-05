import React from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { ExplorerRun } from "../server/functions";

interface DataTableProps {
  data: ExplorerRun[];
  pinnedId: string | null;
  hoveredId: string | null;
  onSelectPin: (id: string | null) => void;
  onHoverRow: (id: string | null) => void;
  costBasis: "reported" | "today";
}

const columnHelper = createColumnHelper<ExplorerRun>();

export function DataTable({
  data,
  pinnedId,
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
      columnHelper.accessor("isKnee", {
        header: "Status",
        cell: (info) => {
          const run = info.row.original;
          const isPinned = pinnedId === run.id;

          if (run.isKnee) {
            return (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-bold text-[10px]">
                ⚡ KNEE
              </span>
            );
          }
          if (run.isFrontier) {
            return (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-semibold text-[10px]">
                FRONTIER
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 text-[10px]">
              Dominated
            </span>
          );
        },
      }),

      columnHelper.accessor("modelDisplayName", {
        header: "Model",
        cell: (info) => {
          const run = info.row.original;
          return (
            <div>
              <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                <span>{run.modelDisplayName}</span>
                {pinnedId === run.id && (
                  <span className="text-amber-400 text-[10px]" title="Pinned">
                    📌
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-500">{run.providerName}</div>
            </div>
          );
        },
      }),

      columnHelper.accessor("harnessName", {
        header: "Harness",
        cell: (info) => {
          const run = info.row.original;
          return (
            <div className="text-zinc-300">
              {run.harnessName}{" "}
              <span className="text-zinc-500 text-[10px]">({run.harnessVersion})</span>
            </div>
          );
        },
      }),

      columnHelper.accessor("effortPresetSlug", {
        header: "Effort",
        cell: (info) => (
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] uppercase font-mono">
            {info.getValue()}
          </span>
        ),
      }),

      columnHelper.accessor("solveRate", {
        header: "Solve Rate",
        cell: (info) => {
          const run = info.row.original;
          const val = info.getValue();
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100">{val.toFixed(1)}%</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  ({run.nSolved}/{run.nTotal})
                </span>
              </div>
              <div className="w-20 bg-zinc-800 rounded-full h-1 mt-1 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                />
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("costPerTaskReported", {
        id: "costPerTask",
        header: costBasis === "today" ? "$/Task (Today)" : "$/Task (Reported)",
        cell: (info) => {
          const run = info.row.original;
          const val = costBasis === "today" ? run.costPerTaskNormalized : run.costPerTaskReported;
          if (val === null || val === undefined) {
            return <span className="text-zinc-600 italic">—</span>;
          }
          return <span className="font-semibold text-zinc-200">${val.toFixed(2)}</span>;
        },
      }),

      columnHelper.accessor("costUsdReported", {
        header: "Total Cost",
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined) {
            return <span className="text-zinc-600 italic">—</span>;
          }
          return <span className="text-zinc-400 font-mono">${val.toFixed(0)}</span>;
        },
      }),

      columnHelper.display({
        id: "telemetry",
        header: "Telemetry",
        cell: (info) => {
          const run = info.row.original;
          return (
            <div className="flex items-center gap-1 text-[9px] font-mono">
              <span
                className={`px-1 py-0.5 rounded border ${
                  run.hasTokens
                    ? "bg-zinc-800/80 text-zinc-300 border-zinc-700"
                    : "text-zinc-700 border-zinc-900 bg-transparent"
                }`}
                title="Tokens telemetry"
              >
                TOK
              </span>
              <span
                className={`px-1 py-0.5 rounded border ${
                  run.hasCost
                    ? "bg-zinc-800/80 text-zinc-300 border-zinc-700"
                    : "text-zinc-700 border-zinc-900 bg-transparent"
                }`}
                title="Cost reported"
              >
                USD
              </span>
              <span
                className={`px-1 py-0.5 rounded border ${
                  run.hasLatency
                    ? "bg-zinc-800/80 text-zinc-300 border-zinc-700"
                    : "text-zinc-700 border-zinc-900 bg-transparent"
                }`}
                title="Latency measured"
              >
                LAT
              </span>
            </div>
          );
        },
      }),
    ],
    [pinnedId, costBasis]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full bg-zinc-950 rounded-lg border border-zinc-800/80 overflow-hidden flex flex-col">
      <div className="px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="font-semibold uppercase tracking-wider">Comparison Table</span>
          <span>&bull;</span>
          <span>{data.length} configurations visible</span>
        </div>
        <div className="text-zinc-500 text-[10px]">
          Hover row to highlight &bull; Click to pin
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-zinc-900/90 sticky top-0 z-10 border-b border-zinc-800 text-[11px] text-zinc-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 font-semibold cursor-pointer select-none hover:text-zinc-200 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ▲",
                        desc: " ▼",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {table.getRowModel().rows.map((row) => {
              const run = row.original;
              const isPinned = pinnedId === run.id;
              const isHovered = hoveredId === run.id;

              let rowClass = "hover:bg-zinc-900/70 transition-colors cursor-pointer";
              if (isPinned) {
                rowClass = "bg-amber-950/20 border-l-2 border-l-amber-500 hover:bg-amber-950/30";
              } else if (isHovered) {
                rowClass = "bg-zinc-800/50";
              } else if (run.isKnee) {
                rowClass = "bg-cyan-950/10 hover:bg-cyan-950/20";
              } else if (row.index % 2 === 1) {
                rowClass = "bg-zinc-950/50 hover:bg-zinc-900/70";
              }

              return (
                <tr
                  key={row.id}
                  className={rowClass}
                  onClick={() => onSelectPin(isPinned ? null : run.id)}
                  onMouseEnter={() => onHoverRow(run.id)}
                  onMouseLeave={() => onHoverRow(null)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-zinc-500">
                  No matching runs found with current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

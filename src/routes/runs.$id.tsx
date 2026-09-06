import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Columns3, FileText } from "lucide-react";
import { getRunDossier, type ExplorerRun } from "../server/functions";
import { parsePassAtK } from "../finder";
import { parseListParam } from "../compare";

type RunDossierSearch = {
  pins?: string;
};

export const Route = createFileRoute("/runs/$id")({
  validateSearch: (search: Record<string, unknown>): RunDossierSearch => ({
    pins:
      search.pins === undefined || search.pins === null ? undefined : String(search.pins),
  }),
  loaderDeps: ({ search }) => ({ pins: search.pins }),
  loader: async ({ params, deps }) => {
    const data = await getRunDossier({ data: { id: params.id } });
    if (!data.run) {
      throw notFound({ routeId: "/runs/$id" });
    }
    return { ...data, pins: parseListParam(deps.pins) };
  },
  notFoundComponent: RunNotFound,
  component: RunDossierPage,
});

function RunNotFound() {
  const { id } = Route.useParams();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#09090b] p-8 text-center">
      <FileText size={28} className="text-zinc-700" />
      <h1 className="text-base font-bold text-zinc-300 font-mono">
        404 — no run with id <span className="text-zinc-100">{id}</span>
      </h1>
      <p className="text-xs text-zinc-500 max-w-md">
        Run ids are benchmark-version scoped ULIDs. If you followed a deep link from an older
        board, the run may belong to a slice that is no longer loaded.
      </p>
      <Link
        to="/"
        className="text-xs text-cyan-300 hover:text-cyan-200 underline mt-1"
      >
        ← Back to the Explorer
      </Link>
    </div>
  );
}

function fmtUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
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
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      {chips.map((c) => (
        <span
          key={c.label}
          title={c.ok ? c.title : `Missing: ${c.title.toLowerCase()}`}
          className={`px-1.5 py-0.5 rounded border ${
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

function Tile({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <div
      className={`bg-zinc-950 border rounded px-2.5 py-2 ${
        ok === false ? "border-zinc-800/60" : "border-zinc-800/80"
      }`}
    >
      <div className="text-[9px] uppercase text-zinc-500 font-semibold tracking-wider">{label}</div>
      <div className={`text-sm font-bold font-mono ${ok === false ? "text-zinc-600" : "text-zinc-100"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function RunDossierPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const run = data.run;
  const bench = data.benchmark;

  // Route loader narrows this, but keep TS honest for the notFound path.
  if (!run || !bench) return RunNotFound();

  const pins = search.pins ?? [];
  const allPins = pins.includes(run.id) ? pins : [...pins, run.id];
  const perResolved =
    run.costUsdReported !== null && run.costUsdReported !== undefined && run.nSolved > 0
      ? run.costUsdReported / run.nSolved
      : null;
  const restatedPerTask = run.costPerTaskNormalized;
  const tokens =
    run.hasTokens && (run.tokensIn !== null || run.tokensOut !== null)
      ? { in: run.tokensIn ?? 0, out: run.tokensOut ?? 0 }
      : null;
  const passK = parsePassAtK(run.passAtK);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-1.5 text-[11px] flex items-center justify-between gap-4 text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold tracking-wide">NOTE</span>
          <span>Run dossier — compiled/seed aggregate for one configuration. Aggregate metrics only; no benchmark task text.</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <a href="/methodology" className="underline hover:text-zinc-300">methodology</a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Header + nav */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-1.5">
              <Link
                to="/"
                search={{
                  benchmark: bench.id,
                  pinned: pins.length > 0 ? pins.join(",") : undefined,
                }}
                className="underline hover:text-zinc-300 inline-flex items-center gap-1"
              >
                <ArrowLeft size={10} />
                {bench.benchmarkName} {bench.version}
              </Link>
              <span className="text-zinc-700">/ run</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-100">
              {run.modelDisplayName}
              <span className="text-xs text-zinc-500 font-mono ml-2">
                {run.providerName} · {run.harnessName}
                {run.harnessVersion !== "default" ? ` v${run.harnessVersion}` : ""} · effort {run.effortPresetSlug}
              </span>
            </h1>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              run id {run.id} · {bench.nTasks}-task suite
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/models/$slug"
              params={{ slug: run.modelSlug }}
              search={{}}
              className="px-2.5 py-1 rounded text-[11px] border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Model page
            </Link>
            {pins.length >= 2 && (
              <Link
                to="/compare"
                search={{ ids: pins.join(","), benchmark: bench.id }}
                className="px-2.5 py-1 rounded text-[11px] bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/60 transition-colors inline-flex items-center gap-1.5"
              >
                <Columns3 size={11} />
                Compare pins ({pins.length})
              </Link>
            )}
          </div>
        </div>

        {/* Metric tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Tile
            label="Solve rate"
            value={`${run.solveRate.toFixed(1)}%`}
            sub={`${run.nSolved}/${run.nTotal} tasks · denominator = suite size`}
          />
          <Tile
            label="$/task (reported)"
            value={run.costPerTaskReported !== null ? fmtUsd(run.costPerTaskReported) : "—"}
            sub={
              run.costUsdReported !== null && run.costUsdReported !== undefined
                ? `$${run.costUsdReported.toFixed(0)} total ÷ ${bench.nTasks}`
                : "no cost telemetry"
            }
            ok={run.costPerTaskReported !== null}
          />
          {/* Restated cost: coverage-gated second number — never a substitute */}
          <Tile
            label="$/task (restated today)"
            value={restatedPerTask !== null ? fmtUsd(restatedPerTask) : "not restated"}
            sub={
              restatedPerTask !== null
                ? `re-priced at current list rates · ${
                    (run.costPerTaskReported ?? 0) > 0
                      ? `${restatedPerTask >= (run.costPerTaskReported as number) ? "+" : ""}${(((restatedPerTask - (run.costPerTaskReported as number)) / (run.costPerTaskReported as number)) * 100).toFixed(0)}% vs reported`
                      : "free at reported pricing"
                  }`
                : "no normalized pricing for this run"
            }
            ok={restatedPerTask !== null}
          />
          <Tile
            label="p50 latency"
            value={run.latencyP50Seconds != null ? `${run.latencyP50Seconds.toFixed(1)}s` : "—"}
            sub={run.hasLatency ? "measured" : "not measured"}
            ok={run.latencyP50Seconds != null}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Cost detail */}
          <div className="bg-zinc-950 rounded border border-zinc-800/80 p-3 flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Cost basis detail
            </div>
            <div className="text-xs text-zinc-300 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">Reported (primary)</span>
                <span className="font-mono font-bold text-zinc-100">
                  {run.costPerTaskReported !== null
                    ? `${fmtUsd(run.costPerTaskReported)}/task`
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">
                  Restated (today pricing){" "}
                  <span className="text-[9px] text-zinc-600">coverage-gated</span>
                </span>
                <span className={`font-mono ${restatedPerTask !== null ? "text-zinc-200" : "text-zinc-600"}`}>
                  {restatedPerTask !== null ? `${fmtUsd(restatedPerTask)}/task` : "not restated"}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">$/resolved</span>
                <span className="font-mono text-zinc-300">
                  {perResolved !== null ? fmtUsd(perResolved) : "—"}
                  <span className="text-[9px] text-zinc-600 ml-1">amortized, hides failures</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-400">Total run cost</span>
                <span className="font-mono text-zinc-300">
                  {run.costUsdReported !== null && run.costUsdReported !== undefined
                    ? `$${run.costUsdReported.toFixed(2)}`
                    : "—"}
                </span>
              </div>
            </div>
            <CoverageChips run={run} />
          </div>

          {/* Telemetry */}
          <div className="bg-zinc-950 rounded border border-zinc-800/80 p-3 flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Telemetry
            </div>
            <div className="text-xs text-zinc-300 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">Tokens (in / out)</span>
                <span className="font-mono text-zinc-200">
                  {tokens ? `${fmtTokens(tokens.in)} / ${fmtTokens(tokens.out)}` : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">Pass@k</span>
                <span className="font-mono text-zinc-200 text-[11px]">
                  {passK.length > 0
                    ? passK.map((p) => `k${p.k}: ${p.percent}%`).join(" · ")
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">Confidence interval</span>
                <span className="font-mono text-zinc-200">
                  {run.hasCi ? "reported" : <span className="text-zinc-600">not reported</span>}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-zinc-400">Source run</span>
                <span className="font-mono text-[10px] text-zinc-400" title={run.sourceRunId}>
                  {run.sourceRunId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Source attribution + actions */}
        <div className="bg-zinc-950 rounded border border-zinc-800/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="text-zinc-500">
            Source:{" "}
            <span className={run.sourceOfficial ? "text-emerald-500/90" : "text-zinc-300"}>
              {run.sourceName}
            </span>{" "}
            <span className="text-zinc-600">
              ({run.sourceOfficial ? "official — maintainer-run & verified" : "compiled — aggregate from public reports, not audited"})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              search={{
                benchmark: bench.id,
                pinned: allPins.join(",") || undefined,
              }}
              className="text-cyan-300 hover:text-cyan-200 underline"
            >
              Open on the Explorer board →
            </Link>
            {pins.length >= 2 && (
              <Link
                to="/compare"
                search={{ ids: pins.join(","), benchmark: bench.id }}
                className="text-cyan-300 hover:text-cyan-200 underline"
              >
                Compare →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

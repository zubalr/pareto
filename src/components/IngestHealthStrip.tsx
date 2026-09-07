import * as React from "react";
import { Activity } from "lucide-react";
import { parseHealthPayload, relativeTime, type IngestHealth } from "../ingestHealth";

// Thin ingest-health strip for the Explorer. Data comes from Agy's
// /api/ingest/health — a 404 or unparseable body renders an honest empty state
// naming the missing endpoint. Never an invented "updated today" timestamp.
export function IngestHealthStrip() {
  const [health, setHealth] = React.useState<IngestHealth | null>(null);
  const [endpointMissing, setEndpointMissing] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [startedAt, setStartedAt] = React.useState<string | null>(null);
  const [ago, setAgo] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ingest/health", { headers: { accept: "application/json" } });
        if (!alive) return;
        if (!res.ok) {
          setEndpointMissing(true);
          return;
        }
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          setEndpointMissing(true);
          return;
        }
        setHealth(parseHealthPayload(json));
        const job = (json as any)?.lastJob;
        const startedAt = job?.startedAt;
        if (typeof startedAt === "string") {
          setStartedAt(startedAt);
          setAgo(relativeTime(startedAt));
        }
      } catch {
        if (alive) setEndpointMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (endpointMissing || (health && health.state === "unknown")) {
    if (dismissed) return null;
    return (
      <div className="bg-zinc-950 border-b border-zinc-800/60 px-4 py-1 text-[10px] text-zinc-500 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          <Activity size={10} className="text-zinc-600" />
          Ingest health: <span className="font-mono">/api/ingest/health</span> not available on this
          deployment — no last-run status to show (needs Agy deploy).
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-zinc-600 hover:text-zinc-400 underline"
          aria-label="Dismiss ingest health notice"
        >
          dismiss
        </button>
      </div>
    );
  }

  if (!health) return null; // still fetching — render nothing rather than a fake state

  return (
    <div
      className={`border-b px-4 py-1 text-[10px] flex items-center gap-2 font-mono ${
        health.errored
          ? "bg-red-950/30 border-red-900/60 text-red-300"
          : health.state === "degraded"
            ? "bg-amber-950/20 border-amber-900/50 text-amber-300"
            : "bg-zinc-950 border-zinc-800/60 text-zinc-400"
      }`}
    >
      <Activity size={10} className={health.errored ? "text-red-400" : "text-emerald-500"} />
      <span className="uppercase tracking-wider text-zinc-500">ingest</span>
      <span>{health.statusLabel}</span>
      {ago && (
        <span title={startedAt ?? undefined} className="text-zinc-500">
          · {ago}
        </span>
      )}
      {health.counts && (
        <span className="text-zinc-500">
          · cost coverage: {health.counts.reported ?? "?"} reported /{" "}
          {health.counts.restated ?? "?"} restated / {health.counts.total ?? "?"} runs
        </span>
      )}
      {health.detail && <span className="text-zinc-500">· {health.detail}</span>}
    </div>
  );
}

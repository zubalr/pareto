// Ingest health strip data parsing — pure, defensive, unit-tested.
// The endpoint is Agy's (`/api/ingest/health`); its shape may evolve, so this
// parser tolerates several field conventions and never invents a timestamp.
// Anything unparseable becomes an honest "unknown status" rather than a guess.

export interface IngestHealth {
  state: "ok" | "degraded" | "error" | "unknown";
  statusLabel: string;
  detail: string | null;
  errored: boolean;
  /** Cost-coverage counts when the endpoint exposes them. */
  counts?: { reported: number; restated: number; total: number };
}

export function parseHealthPayload(json: unknown): IngestHealth | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return null;
  const rec = json as Record<string, unknown>;

  const errText =
    typeof rec.error === "string" && rec.error.trim() !== "" ? rec.error.trim() : null;

  const counts = {
    reported: typeof rec.reportedCostCount === "number" ? rec.reportedCostCount : null,
    restated: typeof rec.restatedCostCount === "number" ? rec.restatedCostCount : null,
    total: typeof rec.totalRuns === "number" ? rec.totalRuns : null,
  };
  const hasCounts = counts.reported !== null || counts.restated !== null || counts.total !== null;

  // { status: "ok" | "error" | ... } — the most likely convention
  if (typeof rec.status === "string") {
    const status = rec.status.toLowerCase();
    const errored = status === "error" || status === "failed";
    const degraded = status === "degraded" || status === "partial";
    const lastJob =
      typeof rec.last_job === "string"
        ? rec.last_job
        : typeof rec.lastJob === "string"
          ? rec.lastJob
          : typeof rec.last_job_status === "string"
            ? rec.last_job_status
            : null;
    return {
      state: errored ? "error" : degraded ? "degraded" : "ok",
      statusLabel: `last job: ${lastJob ?? rec.status}`,
      detail: errText,
      errored,
      ...(hasCounts ? { counts } : {}),
    };
  }

  // { ok: true/false } convention
  if (typeof rec.ok === "boolean") {
    return {
      state: rec.ok ? "ok" : "error",
      statusLabel: rec.ok ? "last job: ok" : "last job: failed",
      detail: errText,
      errored: !rec.ok,
      ...(hasCounts ? { counts } : {}),
    };
  }

  // { jobs: [{ status, ... }, ...] } — take the latest entry's status
  if (Array.isArray(rec.jobs) && rec.jobs.length > 0) {
    const latest = rec.jobs[rec.jobs.length - 1] as Record<string, unknown>;
    const status = typeof latest.status === "string" ? latest.status : "unknown";
    const errored = status.toLowerCase() === "error" || status.toLowerCase() === "failed";
    return {
      state: errored ? "error" : "ok",
      statusLabel: `last job: ${status}`,
      detail: errText,
      errored,
      ...(hasCounts ? { counts } : {}),
    };
  }

  // JSON but unrecognized shape: healthy endpoint, unknown status — say so.
  return {
    state: "unknown",
    statusLabel: "endpoint responded, status shape unrecognized",
    detail: null,
    errored: false,
  };
}

/** Relative time for the health strip ("14m ago"). Pure given `now`. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

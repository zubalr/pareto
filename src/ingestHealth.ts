// Ingest health strip data parsing — pure, defensive, unit-tested.
// The endpoint is Agy's (`/api/ingest/health`); its shape may evolve, so this
// parser tolerates several field conventions and never invents a timestamp.
// Anything unparseable becomes an honest "unknown status" rather than a guess.

export interface IngestHealth {
  state: "ok" | "degraded" | "error" | "unknown";
  statusLabel: string;
  detail: string | null;
  errored: boolean;
}

export function parseHealthPayload(json: unknown): IngestHealth | null {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return null;
  const rec = json as Record<string, unknown>;

  const errText =
    typeof rec.error === "string" && rec.error.trim() !== "" ? rec.error.trim() : null;

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
    };
  }

  // { ok: true/false } convention
  if (typeof rec.ok === "boolean") {
    return {
      state: rec.ok ? "ok" : "error",
      statusLabel: rec.ok ? "last job: ok" : "last job: failed",
      detail: errText,
      errored: !rec.ok,
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

// Phase 12 freshness law — the single source of truth for which boards may be
// recommended. Models move every week: a board is eligible only if its
// upstream leaderboard last published on/after the cutoff and it is not
// frozen, deprecated, superseded, or retired-as-saturated. Thrown boards keep
// their record here (with the reason) so the product can explain absences;
// D1 may still hold their rows, but they are never defaults, never Pick
// intents, and never listed in selectors. Buried ?benchmark= URLs for old ids
// still resolve so links do not 404.

export const FRESHNESS_CUTOFF = "2026-03-08";
export const FRESHNESS_VERIFIED = "2026-09-08";

export interface BoardFreshness {
  verdict: "keep" | "throw";
  /** The upstream last publish / last-modified date we verified (keep only). */
  freshAsOf?: string;
  /** Required for throws — shown wherever the board used to appear. */
  droppedBecause?: string;
  note?: string;
}

/** D1 benchmark versions (Explorer selector, Finder, Compare, coding intents). */
export const D1_BOARDS: Record<string, BoardFreshness> = {
  "01J8BV000000000000DEEPSWE11": {
    verdict: "keep",
    freshAsOf: "2026-09-07",
    note: "leaderboard-live.json Last-Modified 2026-09-07; site 'updated September 3, 2026' (verified 2026-09-08)",
  },
  "01J8BV000000000000000SWE10": {
    verdict: "keep",
    freshAsOf: "2026-09-03",
    note: "swe-bench/experiments repo last commit 2026-09-03 (verified 2026-09-08)",
  },
  "01J8BVAIDER00000000000POLY": {
    verdict: "throw",
    droppedBecause:
      "stale — the upstream Aider polyglot YAML last gained a row on 2025-10-03 (repo last commit 2025-10-04), before the 2026-03-08 cutoff",
  },
  "01J8BV000000000000000TB20": {
    verdict: "throw",
    droppedBecause:
      "superseded — the current Terminal-Bench family is 4.0 (Harbor terminal-bench@4.0.0); TB 2.0 runs are frozen",
  },
  "01J8BV0000000000000000TB40": {
    verdict: "throw",
    droppedBecause:
      "not a living board — this version holds 10 hand-compiled seed fixtures, not an official ingest; it must not be relabeled as 'latest Terminal-Bench 4.0'",
  },
};

/** Compiled snapshot boards (Pick general / math / science). */
export const SNAPSHOT_BOARDS: Record<string, BoardFreshness> = {
  "mmlu-pro": {
    verdict: "keep",
    freshAsOf: "2026-03-11",
    note: "TIGER-Lab leaderboard last update 2026.03.11 — on/after the cutoff (verified 2026-09-08)",
  },
  "aime-2025": {
    verdict: "throw",
    droppedBecause:
      "deprecated — MathArena froze AIME 2025 and superseded it with AIME 2026; newer models are absent by construction",
  },
  "aime-2026": {
    verdict: "keep",
    freshAsOf: "2026-09-08",
    note: "MathArena live board, table retrieved 2026-09-08",
  },
  "scicode": {
    verdict: "keep",
    freshAsOf: "2026-08-28",
    note: "Kaggle Open Benchmarks 'Last updated August 28, 2026' (verified 2026-09-08)",
  },
  "gpqa-diamond": {
    verdict: "throw",
    droppedBecause:
      "retired as saturated — the board top sits at ~95% and no longer ranks new models (AA retired GPQA from its Index)",
  },
};

export function isFreshBench(benchmarkVersionId: string | undefined | null): boolean {
  if (!benchmarkVersionId) return false;
  return D1_BOARDS[benchmarkVersionId]?.verdict === "keep";
}

export function isFreshSnapshotBoard(key: string | undefined | null): boolean {
  if (!key) return false;
  return SNAPSHOT_BOARDS[key]?.verdict === "keep";
}

/** Convenience: the keep-verdict D1 board ids (selector order: DeepSWE first). */
export const FRESH_D1_BOARD_IDS = Object.entries(D1_BOARDS)
  .filter(([, v]) => v.verdict === "keep")
  .map(([id]) => id);

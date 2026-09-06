// Finder selection logic — pure, deterministic, unit-tested.
// See DESIGN.md §8 for the product spec and the $50 Terminal-Bench worked example.

export type FinderObjective = "max-solve" | "min-cost-per-resolved";

export interface FinderCriterion {
  maxCostPerTask: number;
  maxLatencyP50Seconds?: number | null;
  objective: FinderObjective;
}

export type FinderExclusionReason =
  | "no-cost-telemetry"
  | "over-budget"
  | "no-latency-telemetry"
  | "over-latency-budget"
  | "unrankable"; // e.g. zero resolved tasks under min-cost-per-resolved

export interface FinderCandidate {
  id: string;
  modelDisplayName: string;
  modelSlug: string;
  harnessName: string;
  harnessVersion: string;
  effortPresetSlug: string;
  solveRate: number;
  cost: number | null; // USD/task in the active basis
  costUsdTotal: number | null;
  nSolved: number;
  latencyP50Seconds: number | null;
  sourceName: string;
  sourceOfficial: boolean;
  sourceRunId: string;
  [key: string]: any;
}

export interface FinderExclusion {
  run: FinderCandidate;
  reason: FinderExclusionReason;
}

export interface FinderResult<T extends FinderCandidate> {
  eligible: T[];
  best: T | null;
  alternatives: T[];
  excluded: FinderExclusion[];
}

/**
 * Applies the Finder rules to a benchmark slice:
 * - eligibility requires positive reported cost <= maxCostPerTask (missing cost
 *   can never be assumed within budget);
 * - a latency cap requires measured p50 latency <= cap (unmeasured = unverifiable);
 * - ranking is max solve rate, or min USD per resolved task (total cost / n_solved,
 *   which requires n_solved > 0);
 * - alternatives prefer different models than the winner so a researcher sees a
 *   real choice, falling back to same-model runners-up.
 * Deterministic: ties break on cost, then id.
 */
export function selectFinder<T extends FinderCandidate>(
  runs: T[],
  criterion: FinderCriterion
): FinderResult<T> {
  const eligible: T[] = [];
  const excluded: FinderExclusion[] = [];

  const hasCap = Number.isFinite(criterion.maxCostPerTask) && criterion.maxCostPerTask > 0;
  const latencyCap =
    criterion.maxLatencyP50Seconds !== null &&
    criterion.maxLatencyP50Seconds !== undefined &&
    Number.isFinite(criterion.maxLatencyP50Seconds) &&
    criterion.maxLatencyP50Seconds > 0;

  for (const run of runs) {
    const cost = run.cost;
    if (cost === null || cost === undefined || Number.isNaN(cost) || cost <= 0) {
      excluded.push({ run, reason: "no-cost-telemetry" });
      continue;
    }
    if (hasCap && cost > criterion.maxCostPerTask) {
      excluded.push({ run, reason: "over-budget" });
      continue;
    }
    if (latencyCap) {
      if (run.latencyP50Seconds === null || run.latencyP50Seconds === undefined) {
        excluded.push({ run, reason: "no-latency-telemetry" });
        continue;
      }
      if (run.latencyP50Seconds > (criterion.maxLatencyP50Seconds as number)) {
        excluded.push({ run, reason: "over-latency-budget" });
        continue;
      }
    }
    eligible.push(run);
  }

  const costPerResolved = (r: T): number | null => {
    if (r.costUsdTotal === null || r.costUsdTotal === undefined || r.nSolved <= 0) return null;
    return r.costUsdTotal / r.nSolved;
  };

  const rankKey = (r: T): number | null => {
    if (criterion.objective === "max-solve") return r.solveRate;
    return costPerResolved(r);
  };

  const rankable = eligible.filter((r) => rankKey(r) !== null);
  for (const r of eligible) {
    if (rankKey(r) === null) {
      excluded.push({ run: r, reason: "unrankable" });
    }
  }

  const ranked = [...rankable].sort((a, b) => {
    const ka = rankKey(a) as number;
    const kb = rankKey(b) as number;
    if (criterion.objective === "max-solve") {
      if (kb !== ka) return kb - ka; // higher solve first
    } else {
      if (ka !== kb) return ka - kb; // lower $/resolved first
    }
    const ca = a.cost ?? 0;
    const cb = b.cost ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const best = ranked.length > 0 ? ranked[0] : null;

  // Alternatives: next two ranked runs, preferring models other than the winner's.
  const alternatives: T[] = [];
  if (best) {
    for (const r of ranked.slice(1)) {
      if (alternatives.length >= 2) break;
      if (r.modelSlug !== best.modelSlug && !alternatives.some((a) => a.modelSlug === r.modelSlug)) {
        alternatives.push(r);
      }
    }
    for (const r of ranked.slice(1)) {
      if (alternatives.length >= 2) break;
      if (!alternatives.includes(r) && r.modelSlug === best.modelSlug) {
        alternatives.push(r);
      }
    }
  }

  return { eligible, best, alternatives, excluded };
}

/**
 * Parses a `pass_at_k` JSON text column into ascending [k, percent] pairs.
 * Tolerates values stored as numbers or numeric strings; returns [] when the
 * column is empty, "{}", or unparseable — callers must treat that as no data.
 */
export function parsePassAtK(text: string): Array<{ k: number; percent: number }> {
  if (!text || text.trim() === "" || text.trim() === "{}") return [];
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .map(([k, v]) => ({ k: Number(k), percent: Number(v) }))
      .filter((e) => Number.isFinite(e.k) && e.k > 0 && Number.isFinite(e.percent));
    entries.sort((a, b) => a.k - b.k);
    return entries;
  } catch {
    return [];
  }
}

// Canonical effort ordering for the Effort slot X axis.
export const EFFORT_ORDER = ["low", "medium", "med", "high", "max", "none", "default"];

export function effortRank(slug: string): number {
  const idx = EFFORT_ORDER.indexOf(slug.toLowerCase());
  return idx === -1 ? EFFORT_ORDER.length : idx;
}

// Pick — domain → budget → one configuration answer. Pure, deterministic,
// unit-tested. Ranking reuses selectFinder from finder.ts (there is exactly one
// ranker in this app); this module adapts candidate shapes and adds the Pick
// framing (floor as a hard constraint, cheaper alternative, spend-more option).
// See DESIGN.md §Pick and the Phase 11 methodology section.

import {
  selectFinder,
  type FinderCandidate,
  type FinderObjective,
  type FinderResult,
} from "./finder";
import {
  COMPILED_SCORES,
  COMPILED_SOURCES,
  type CompiledBenchKey,
  type CompiledModelRow,
} from "./data/compiled-domain-scores";

export type PickDomain = "coding" | "general" | "math" | "science";
export type PickObjective = "best" | "cheapest-floor" | "min-resolved";
export type CodingIntent = "agentic" | "terminal" | "polyglot" | "github";

export const PICK_DOMAINS: PickDomain[] = ["coding", "general", "math", "science"];

export const DEFAULT_FLOOR: Record<PickDomain, number> = {
  coding: 50,
  general: 60,
  math: 40,
  science: 40,
};

/** Budget presets. Coding caps $/task (live D1); snapshot domains cap the
 *  OpenRouter list $/M output price proxy. "inf" = no cap. */
export const BUDGET_PRESETS: Record<PickDomain, string[]> = {
  coding: ["0.5", "2", "10", "50", "inf"],
  general: ["1", "5", "15", "50", "inf"],
  math: ["1", "5", "15", "50", "inf"],
  science: ["1", "5", "15", "50", "inf"],
};

export interface DomainBoard {
  primary: string;
  subIntents: string[];
  basis: "live-d1" | "snapshot";
  benchKey?: CompiledBenchKey;
}

/** The domain → bench map. Do not improvise (DESIGN.md §Pick). */
export const DOMAIN_BOARD: Record<PickDomain, DomainBoard> = {
  coding: {
    primary: "DeepSWE 1.1",
    subIntents: ["Harbor TB 2.0", "Aider Polyglot", "SWE-bench Verified"],
    basis: "live-d1",
  },
  general: {
    primary: "MMLU-Pro",
    subIntents: [], // IFEval is not in the compiled snapshot yet
    basis: "snapshot",
    benchKey: "mmlu-pro",
  },
  math: {
    primary: "AIME 2025",
    subIntents: [],
    basis: "snapshot",
    benchKey: "aime-2025",
  },
  science: {
    primary: "SciCode",
    subIntents: ["GPQA Diamond (saturated)"],
    basis: "snapshot",
    benchKey: "scicode",
  },
};

/** Science sub-intent → its own snapshot board. */
export const SUBINTENT_BENCH: Partial<Record<PickDomain, Record<string, CompiledBenchKey>>> = {
  science: { gpqa: "gpqa-diamond" },
};

/** Coding intent → live D1 benchmark version. Primary board is DeepSWE 1.1. */
export const INTENT_BENCH: Record<CodingIntent, { id: string; label: string; bench: string; effortMatch: "max" | "all" }> = {
  agentic: { id: "01J8BV000000000000DEEPSWE11", label: "Agentic SWE", bench: "DeepSWE 1.1", effortMatch: "max" },
  terminal: { id: "01J8BV000000000000000TB20", label: "Terminal", bench: "Harbor TB 2.0", effortMatch: "all" },
  polyglot: { id: "01J8BVAIDER00000000000POLY", label: "Polyglot", bench: "Aider Polyglot 1.0", effortMatch: "all" },
  github: { id: "01J8BV000000000000000SWE10", label: "GitHub bugs", bench: "SWE-bench Verified 1.0", effortMatch: "all" },
};

export const CODING_INTENTS: CodingIntent[] = ["agentic", "terminal", "polyglot", "github"];

/** Cost semantics chip — the proxy rule lives here so UI and tests agree. */
export function costSemantics(domain: PickDomain): {
  unit: string;
  proxy: boolean;
  label: string;
} {
  if (domain === "coding") {
    return { unit: "$/task", proxy: false, label: "measured $/task (reported basis)" };
  }
  return {
    unit: "$/M out",
    proxy: true,
    label: "list $/M output — price proxy, not $/task",
  };
}

/** The comparable coding slice: matched-effort runs (max for the agentic
 *  default) so recommendations differ only where it matters. Other intents
 *  keep all runs; every answer still names its effort. */
export function comparableCodingSlice(
  candidates: FinderCandidate[],
  intent: CodingIntent
): FinderCandidate[] {
  if (intent !== "agentic") return candidates;
  return candidates.filter((c) => c.effortPresetSlug === "max");
}

/** Adapts a compiled snapshot row to the Finder candidate shape on one board.
 *  cost is the OpenRouter list $/M output PROXY — the UI must label it so.
 *  Rows without a price keep cost null: the budget filter omits them (the same
 *  rule as a coding run without cost telemetry), never a plotted zero. */
export function snapshotRowToCandidate(row: CompiledModelRow, bench: CompiledBenchKey): FinderCandidate | null {
  const score = row.scores[bench];
  if (!score) return null;
  const src = COMPILED_SOURCES[score.src];
  return {
    id: `compiled:${bench}:${row.slug}`,
    modelDisplayName: row.displayName,
    modelSlug: row.slug,
    harnessName: "published eval",
    harnessVersion: "-",
    effortPresetSlug: score.note ?? "default",
    solveRate: score.pct,
    cost: row.priceOut ?? null,
    costUsdTotal: null,
    nSolved: 0,
    latencyP50Seconds: null,
    sourceName: src?.name ?? score.src,
    sourceOfficial: false,
    sourceRunId: `${score.src}:${row.slug}`,
  };
}

/** All snapshot candidates on one compiled board (rows with that score only). */
export function snapshotCandidates(bench: CompiledBenchKey): FinderCandidate[] {
  const out: FinderCandidate[] = [];
  for (const row of COMPILED_SCORES) {
    const c = snapshotRowToCandidate(row, bench);
    if (c) out.push(c);
  }
  return out;
}

export interface PickParams {
  budget: number | null; // null = unlimited
  floor: number;
  objective: PickObjective;
}

export interface PickAnswer<T extends FinderCandidate> {
  best: T | null;
  /** Strictly cheaper eligible run that still clears the floor. */
  cheaper: T | null;
  /** Cheapest over-budget run that beats the answer's score ("spend more"). */
  strongerOverBudget: T | null;
  /** Same model at a higher effort preset on the same bench, when it exists. */
  upgrade: T | null;
  sliceSize: number;
  eligibleCount: number;
  omitted: { noPrice: number; belowFloor: number };
  result: FinderResult<T> | null;
}

function toFinderObjective(objective: PickObjective, hasTaskCost: boolean): FinderObjective {
  if (objective === "cheapest-floor") return "cheapest-at-floor";
  if (objective === "min-resolved" && hasTaskCost) return "min-cost-per-resolved";
  return "max-solve";
}

/**
 * Applies Pick to one candidate slice:
 * - the quality floor is a hard constraint applied BEFORE ranking (runs under
 *   the floor are excluded, never silently accepted);
 * - budget eligibility and ranking are selectFinder's rules, unchanged;
 * - `cheaper` prefers strictly cheaper eligible configs; `strongerOverBudget`
 *   prefers the cheapest over-budget run that outscores the answer (the next
 *   real step up), and `upgrade` is the same model at a higher effort preset.
 * Deterministic: ties break on cost, then id (via selectFinder).
 */
export function pickFromCandidates<T extends FinderCandidate>(
  candidates: T[],
  params: PickParams,
  opts: { hasTaskCost: boolean } = { hasTaskCost: true }
): PickAnswer<T> {
  const floor = Number.isFinite(params.floor) ? params.floor : 0;
  const belowFloor = candidates.filter((c) => c.solveRate < floor);
  const floored = candidates.filter((c) => c.solveRate >= floor);

  const objective = toFinderObjective(params.objective, opts.hasTaskCost);
  const result = selectFinder(floored, {
    maxCostPerTask:
      params.budget === null || !Number.isFinite(params.budget)
        ? Number.POSITIVE_INFINITY
        : (params.budget as number),
    objective,
    minSolve: objective === "cheapest-at-floor" ? floor : null,
  });

  const best = result.best;
  let cheaper: T | null = null;
  if (best) {
    const bestCost = best.cost ?? Number.POSITIVE_INFINITY;
    for (const r of result.eligible) {
      if (r.id === best.id) continue;
      const rc = r.cost;
      if (rc === null || rc === undefined) continue;
      if (rc >= bestCost) continue;
      if (
        !cheaper ||
        (rc as number) < (cheaper.cost as number) ||
        ((rc as number) === (cheaper.cost as number) && r.solveRate > cheaper.solveRate)
      ) {
        cheaper = r;
      }
    }
  }

  let strongerOverBudget: T | null = null;
  if (best && params.budget !== null && Number.isFinite(params.budget)) {
    const cap = params.budget as number;
    const over = candidates.filter(
      (c) =>
        c.id !== best.id &&
        c.cost !== null &&
        c.cost !== undefined &&
        c.cost > cap &&
        c.solveRate > best.solveRate
    );
    for (const r of over) {
      if (
        !strongerOverBudget ||
        (r.cost as number) < (strongerOverBudget.cost as number) ||
        ((r.cost as number) === (strongerOverBudget.cost as number) &&
          r.solveRate > strongerOverBudget.solveRate)
      ) {
        strongerOverBudget = r;
      }
    }
  }

  let upgrade: T | null = null;
  if (best) {
    const rank = (e: string): number => {
      const order = ["none", "low", "medium", "med", "high", "max", "xhigh", "default"];
      return order.indexOf(e.toLowerCase());
    };
    for (const r of candidates) {
      if (r.modelSlug !== best.modelSlug || r.id === best.id) continue;
      if (rank(r.effortPresetSlug) > rank(best.effortPresetSlug)) {
        if (!upgrade || rank(r.effortPresetSlug) > rank(upgrade.effortPresetSlug)) upgrade = r;
      }
    }
  }

  return {
    best,
    cheaper,
    strongerOverBudget,
    upgrade,
    sliceSize: candidates.length,
    eligibleCount: result.eligible.length,
    omitted: {
      noPrice: result.excluded.filter((e) => e.reason === "no-cost-telemetry").length,
      belowFloor: belowFloor.length,
    },
    result,
  };
}

/** Builds the snapshot candidate slice for a domain (and optional sub-intent). */
export function pickSliceCandidates(
  domain: Exclude<PickDomain, "coding">,
  subIntent?: string
): FinderCandidate[] {
  const bench =
    (subIntent && SUBINTENT_BENCH[domain]?.[subIntent]) || DOMAIN_BOARD[domain].benchKey;
  return snapshotCandidates(bench as CompiledBenchKey);
}

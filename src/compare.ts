// Compare matrix selection — pure, deterministic, unit-tested.
// Same-benchmark guarantee lives upstream: the server function only ever queries
// one benchmark version, so ids/slugs from other benches simply do not resolve
// and are reported as unknown.

export const COMPARE_MAX = 8;

export interface CompareCandidate {
  id: string;
  modelSlug: string;
  modelDisplayName: string;
  solveRate: number;
  [key: string]: any;
}

export interface CompareSelection<T extends CompareCandidate> {
  selected: T[];
  unknownIds: string[];
  unknownSlugs: string[];
  truncated: boolean;
}

/**
 * Resolves requested run ids and model slugs against one benchmark slice.
 * - ids resolve exactly (request order preserved);
 * - slugs expand to every run of that model on the slice (solve rate desc);
 * - duplicates collapse on run id;
 * - the result caps at `max` (2–8 product rule), reporting truncation.
 */
export function selectCompareRuns<T extends CompareCandidate>(
  runs: T[],
  ids: string[],
  slugs: string[],
  max: number = COMPARE_MAX
): CompareSelection<T> {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const selected: T[] = [];
  const seen = new Set<string>();
  const unknownIds: string[] = [];
  const unknownSlugs: string[] = [];

  const push = (r: T) => {
    if (seen.has(r.id)) return;
    if (selected.length >= max) return;
    seen.add(r.id);
    selected.push(r);
  };

  for (const id of ids) {
    const run = byId.get(id);
    if (!run) {
      unknownIds.push(id);
      continue;
    }
    push(run);
  }

  for (const slug of slugs) {
    const modelRuns = runs
      .filter((r) => r.modelSlug === slug)
      .sort((a, b) => b.solveRate - a.solveRate);
    if (modelRuns.length === 0) {
      unknownSlugs.push(slug);
      continue;
    }
    for (const run of modelRuns) push(run);
  }

  const total = totalMatches(runs, ids, slugs);
  return { selected, unknownIds, unknownSlugs, truncated: total > max };
}

function totalMatches(runs: any[], ids: string[], slugs: string[]): number {
  const idSet = new Set(ids);
  let n = runs.filter((r) => idSet.has(r.id)).length;
  const slugSet = new Set(slugs);
  n += runs.filter((r) => slugSet.has(r.modelSlug) && !idSet.has(r.id)).length;
  return n;
}

/** Parses a comma-separated compare param into a clean list. */
export function parseListParam(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Resource multipliers vs a baseline configuration — pure, deterministic.
// Shipped encoding (revises DESIGN.md §6.3): grouped bars, x = metric group
// (USD/task, tokens, wall-clock), bars = configurations, value = multiplier vs
// the baseline (baseline = 1.0×). Coverage rules:
// - baseline = cheapest configuration with positive reported cost in the slice;
// - a configuration without a metric's telemetry gets no bar in that group;
// - if the BASELINE lacks a metric, that whole group is suppressed — a
//   multiplier against an unmeasured baseline would be fabricated.

export type ResourceMetricKey = "usd" | "tokens" | "wallclock";

export interface ResourceRun {
  id: string;
  modelDisplayName: string;
  harnessName: string;
  effortPresetSlug: string;
  solveRate: number;
  cost: number | null; // USD/task, positive
  hasTokens: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  hasLatency: boolean;
  latencyP50Seconds: number | null;
  [key: string]: any;
}

export interface ResourceConfig {
  run: ResourceRun;
  isBaseline: boolean;
  usd: { abs: number; mult: number } | null;
  tokens: { abs: number; mult: number } | null;
  wallclock: { abs: number; mult: number } | null;
}

export interface ResourceCompare {
  baseline: ResourceRun | null;
  configs: ResourceConfig[];
  groups: {
    usd: boolean;
    tokens: boolean;
    wallclock: boolean;
  };
  notes: string[];
}

function tokenTotal(r: ResourceRun): number | null {
  if (!r.hasTokens) return null;
  if (r.tokensIn === null && r.tokensOut === null) return null;
  return (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
}

/**
 * Picks the configurations to draw when a slice has many runs: frontier members
 * first, then by solve rate desc, capped. The baseline is always included.
 */
export function pickResourceConfigs<T extends ResourceRun>(runs: T[], max: number): T[] {
  const costed = runs.filter(
    (r) => r.cost !== null && r.cost !== undefined && r.cost > 0
  );
  const baseline = costed.reduce<T | null>(
    (min, r) => (min === null || (r.cost as number) < (min.cost as number) ? r : min),
    null
  );
  const rest = costed
    .filter((r) => r.id !== baseline?.id)
    .sort((a, b) => {
      if (a.isFrontier !== b.isFrontier) return a.isFrontier ? -1 : 1;
      return b.solveRate - a.solveRate;
    })
    .slice(0, Math.max(0, max - 1));
  return baseline ? [baseline, ...rest] : [];
}

export function buildResourceCompare(runs: ResourceRun[], max = 8): ResourceCompare {
  const notes: string[] = [];
  const costed = runs.filter(
    (r) => r.cost !== null && r.cost !== undefined && Number.isFinite(r.cost) && r.cost > 0
  );

  if (costed.length === 0) {
    return {
      baseline: null,
      configs: [],
      groups: { usd: false, tokens: false, wallclock: false },
      notes: ["No configuration in this slice reports cost."],
    };
  }

  const baseline = costed.reduce<ResourceRun>(
    (min, r) => ((r.cost as number) < (min.cost as number) ? r : min),
    costed[0]
  );

  const baselineTokens = tokenTotal(baseline);
  const baselineClock = baseline.hasLatency ? baseline.latencyP50Seconds : null;

  const candidates = pickResourceConfigs(costed, max);

  const configs: ResourceConfig[] = candidates.map((r) => {
    const tokensAbs = tokenTotal(r);
    const clockAbs = r.hasLatency ? r.latencyP50Seconds : null;
    return {
      run: r,
      isBaseline: r.id === baseline.id,
      usd: { abs: r.cost as number, mult: (r.cost as number) / (baseline.cost as number) },
      tokens:
        tokensAbs !== null && baselineTokens !== null && baselineTokens > 0
          ? { abs: tokensAbs, mult: tokensAbs / baselineTokens }
          : null,
      wallclock:
        clockAbs !== null && baselineClock !== null && baselineClock > 0
          ? { abs: clockAbs, mult: clockAbs / baselineClock }
          : null,
    };
  });

  if (baselineTokens === null) {
    notes.push("Baseline lacks token telemetry — tokens group suppressed.");
  }
  if (!baseline.hasLatency || baseline.latencyP50Seconds === null) {
    notes.push("Baseline lacks latency telemetry — wall-clock group suppressed.");
  }
  if (costed.length > candidates.length) {
    notes.push(`${costed.length - candidates.length} costed configurations not drawn (cap ${max}).`);
  }

  const groups = {
    usd: configs.some((c) => c.usd !== null),
    tokens: configs.some((c) => c.tokens !== null),
    wallclock: configs.some((c) => c.wallclock !== null),
  };

  if (!groups.usd && !groups.tokens && !groups.wallclock) {
    notes.push("No resource metrics comparable against the baseline.");
  }

  return { baseline, configs, groups, notes };
}

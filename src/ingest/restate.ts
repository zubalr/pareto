/**
 * Pareto Cost Restatement Module
 *
 * Restates costs on the "Today" basis (cost_usd_normalized, cost_per_task_normalized)
 * using the latest OpenRouter pricing snapshots for each model.
 *
 * Formula:
 *   cost_usd_normalized = (tokens_in * (prompt_per_1m / 1e6)) + (tokens_out * (completion_per_1m / 1e6))
 *   cost_per_task_normalized = cost_usd_normalized / n_total
 *
 * Invariants:
 * - A run must have both a pricing snapshot for its model and reported token counts (tokens_in != null).
 * - If tokens are missing, normalized costs remain/become NULL (we never invent a restatement from reported USD).
 * - Reported costs (cost_usd_reported, cost_per_task_reported) remain untouched.
 */

export interface RestateRunRow {
  id: string;
  model_id: string;
  model_slug: string;
  n_total: number;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd_reported: number | null;
  cost_usd_normalized: number | null;
  cost_per_task_reported: number | null;
  cost_per_task_normalized: number | null;
}

export interface ModelPricingSnapshot {
  model_id: string;
  prompt_per_1m: number;
  completion_per_1m: number;
}

export interface UnmatchedBreakdown {
  no_alias: number;
  no_snapshot: number;
  no_tokens: number;
}

export interface RestateResult {
  totalRunsEvaluated: number;
  runsRestated: number;
  runsResetToNull: number;
  unchangedCount: number;
  unmatched: UnmatchedBreakdown;
  sampleRestatements: Array<{
    runId: string;
    modelSlug: string;
    costUsdReported: number | null;
    costUsdNormalized: number | null;
    costPerTaskNormalized: number | null;
  }>;
}

export function computeUnmatchedBreakdown(
  unrestatedRuns: Array<{ tokens_in?: number | null; model_id: string }>,
  pricingModelIds: Set<string>,
  aliasModelIds: Set<string>
): UnmatchedBreakdown {
  let no_tokens = 0;
  let no_alias = 0;
  let no_snapshot = 0;

  for (const run of unrestatedRuns) {
    if (run.tokens_in == null || run.tokens_in <= 0) {
      no_tokens++;
    } else if (!aliasModelIds.has(run.model_id)) {
      no_alias++;
    } else if (!pricingModelIds.has(run.model_id)) {
      no_snapshot++;
    } else {
      // In case pricing exists but promptPer1m was NaN or non-positive
      no_snapshot++;
    }
  }

  return { no_alias, no_snapshot, no_tokens };
}

/**
 * Pure calculation function for normalized cost.
 * Returns null for runs lacking tokens or pricing.
 */
export function calculateNormalizedCost(
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
  nTotal: number,
  promptPer1m: number | null | undefined,
  completionPer1m: number | null | undefined
): { costUsdNormalized: number | null; costPerTaskNormalized: number | null } {
  // If tokens are missing or no prompt pricing available, remain NULL
  if (tokensIn == null || promptPer1m == null || isNaN(promptPer1m) || nTotal <= 0) {
    return { costUsdNormalized: null, costPerTaskNormalized: null };
  }

  const promptPricePerToken = promptPer1m / 1_000_000;
  const compPricePer1m = completionPer1m ?? promptPer1m;
  const compPricePerToken = (isNaN(compPricePer1m) ? promptPer1m : compPricePer1m) / 1_000_000;

  const tin = Math.max(0, tokensIn);
  const tout = Math.max(0, tokensOut ?? 0);

  const costUsd = Number((tin * promptPricePerToken + tout * compPricePerToken).toFixed(6));
  const costPerTask = Number((costUsd / nTotal).toFixed(6));

  return {
    costUsdNormalized: costUsd,
    costPerTaskNormalized: costPerTask,
  };
}

export interface RecomputeNormalizedCostsOptions {
  d1: any;
}

/**
 * Recomputes normalized costs across all benchmark_runs in D1.
 * Idempotent: only issues D1 update statements when values change.
 */
export async function recomputeNormalizedCosts(
  options: RecomputeNormalizedCostsOptions
): Promise<RestateResult> {
  const { d1 } = options;

  if (!d1) {
    throw new Error("recomputeNormalizedCosts requires a valid D1 binding.");
  }

  // 1. Fetch latest pricing snapshot for each model and aliases
  const [pricingRes, aliasesRes] = await Promise.all([
    d1
      .prepare(
        `SELECT ps.model_id, ps.prompt_per_1m, ps.completion_per_1m
         FROM pricing_snapshots ps
         INNER JOIN (
           SELECT model_id, max(snapshot_date) as max_date
           FROM pricing_snapshots
           GROUP BY model_id
         ) latest ON ps.model_id = latest.model_id AND ps.snapshot_date = latest.max_date`
      )
      .all(),
    d1.prepare("SELECT DISTINCT model_id FROM model_aliases WHERE alias LIKE '%/%'").all(),
  ]);

  const pricingMap = new Map<string, { prompt_per_1m: number; completion_per_1m: number }>();
  for (const row of (pricingRes.results || []) as ModelPricingSnapshot[]) {
    pricingMap.set(row.model_id, {
      prompt_per_1m: Number(row.prompt_per_1m),
      completion_per_1m: Number(row.completion_per_1m),
    });
  }

  const aliasModelIds = new Set<string>();
  for (const row of (aliasesRes.results || []) as Array<{ model_id: string }>) {
    aliasModelIds.add(row.model_id);
  }

  // 2. Fetch all runs from benchmark_runs
  const runsRes = await d1
    .prepare(
      `SELECT r.id, r.model_id, m.slug as model_slug, r.n_total,
              r.tokens_in, r.tokens_out, r.cost_usd_reported, r.cost_usd_normalized,
              r.cost_per_task_reported, r.cost_per_task_normalized
       FROM benchmark_runs r
       JOIN models m ON r.model_id = m.id`
    )
    .all();

  const runs = (runsRes.results || []) as RestateRunRow[];
  const updateStatements: any[] = [];
  let runsRestated = 0;
  let runsResetToNull = 0;
  let unchangedCount = 0;
  const sampleRestatements: RestateResult["sampleRestatements"] = [];
  const unrestatedRuns: RestateRunRow[] = [];

  for (const run of runs) {
    const pricing = pricingMap.get(run.model_id);
    const { costUsdNormalized, costPerTaskNormalized } = calculateNormalizedCost(
      run.tokens_in,
      run.tokens_out,
      run.n_total,
      pricing?.prompt_per_1m,
      pricing?.completion_per_1m
    );

    // Check if values changed
    const currentCost = run.cost_usd_normalized;
    const currentCostPerTask = run.cost_per_task_normalized;

    const hasChanged =
      costUsdNormalized !== currentCost || costPerTaskNormalized !== currentCostPerTask;

    if (hasChanged) {
      if (costUsdNormalized != null) {
        runsRestated++;
        if (sampleRestatements.length < 5) {
          sampleRestatements.push({
            runId: run.id,
            modelSlug: run.model_slug,
            costUsdReported: run.cost_usd_reported,
            costUsdNormalized,
            costPerTaskNormalized,
          });
        }
      } else {
        runsResetToNull++;
        unrestatedRuns.push(run);
      }

      updateStatements.push(
        d1
          .prepare(
            `UPDATE benchmark_runs
             SET cost_usd_normalized = ?, cost_per_task_normalized = ?
             WHERE id = ?`
          )
          .bind(costUsdNormalized, costPerTaskNormalized, run.id)
      );
    } else {
      if (costUsdNormalized != null) {
        runsRestated++;
        if (sampleRestatements.length < 5) {
          sampleRestatements.push({
            runId: run.id,
            modelSlug: run.model_slug,
            costUsdReported: run.cost_usd_reported,
            costUsdNormalized,
            costPerTaskNormalized,
          });
        }
      } else {
        unrestatedRuns.push(run);
      }
      unchangedCount++;
    }
  }

  const pricingModelIds = new Set(pricingMap.keys());
  const unmatched = computeUnmatchedBreakdown(unrestatedRuns, pricingModelIds, aliasModelIds);

  // Execute updates in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < updateStatements.length; i += BATCH_SIZE) {
    const chunk = updateStatements.slice(i, i + BATCH_SIZE);
    await d1.batch(chunk);
  }

  return {
    totalRunsEvaluated: runs.length,
    runsRestated,
    runsResetToNull,
    unchangedCount,
    unmatched,
    sampleRestatements,
  };
}

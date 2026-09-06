import { describe, it, expect } from "vitest";
import { calculateNormalizedCost, computeUnmatchedBreakdown } from "../src/ingest/restate";

describe("calculateNormalizedCost", () => {
  it("computes normalized total cost and cost per task accurately", () => {
    // 1M prompt tokens at $2/1M, 500k completion tokens at $8/1M, 50 tasks
    // cost = 1_000_000 * 2e-6 + 500_000 * 8e-6 = $2.00 + $4.00 = $6.00
    // cost per task = $6.00 / 50 = $0.12
    const result = calculateNormalizedCost(1_000_000, 500_000, 50, 2.0, 8.0);
    expect(result.costUsdNormalized).toBe(6.0);
    expect(result.costPerTaskNormalized).toBe(0.12);
  });

  it("handles fallback to prompt pricing when completion pricing is null or undefined", () => {
    // 100k prompt tokens, 100k completion tokens at $5/1M prompt price
    // cost = 100_000 * 5e-6 + 100_000 * 5e-6 = $0.50 + $0.50 = $1.00
    const result = calculateNormalizedCost(100_000, 100_000, 10, 5.0, null);
    expect(result.costUsdNormalized).toBe(1.0);
    expect(result.costPerTaskNormalized).toBe(0.1);
  });

  it("returns null when tokens_in is null (missing telemetry)", () => {
    const result = calculateNormalizedCost(null, 100_000, 66, 5.0, 15.0);
    expect(result.costUsdNormalized).toBeNull();
    expect(result.costPerTaskNormalized).toBeNull();
  });

  it("returns null when tokens_in is undefined", () => {
    const result = calculateNormalizedCost(undefined, undefined, 66, 5.0, 15.0);
    expect(result.costUsdNormalized).toBeNull();
    expect(result.costPerTaskNormalized).toBeNull();
  });

  it("returns null when prompt price is null or undefined", () => {
    const result = calculateNormalizedCost(500_000, 100_000, 66, null, null);
    expect(result.costUsdNormalized).toBeNull();
    expect(result.costPerTaskNormalized).toBeNull();
  });

  it("returns null when n_total is zero or negative", () => {
    const result = calculateNormalizedCost(500_000, 100_000, 0, 5.0, 15.0);
    expect(result.costUsdNormalized).toBeNull();
    expect(result.costPerTaskNormalized).toBeNull();
  });

  it("computes fractions with 6 decimal precision correctly", () => {
    // 317591 tokens in at $0.08 / 1M, 120418 tokens out at $0.28 / 1M, 225 tasks
    // tin cost = 317591 * 0.08 / 1e6 = 0.02540728
    // tout cost = 120418 * 0.28 / 1e6 = 0.03371704
    // total = 0.05912432 -> rounded to 0.059124
    // per task = 0.059124 / 225 = 0.00026277333 -> 0.000263
    const result = calculateNormalizedCost(317591, 120418, 225, 0.08, 0.28);
    expect(result.costUsdNormalized).toBe(0.059124);
    expect(result.costPerTaskNormalized).toBe(0.000263);
  });
});

describe("computeUnmatchedBreakdown", () => {
  it("categorizes missing tokens as no_tokens", () => {
    const pricing = new Set(["mod-1"]);
    const aliases = new Set(["mod-1", "mod-2"]);
    const runs = [
      { tokens_in: null, model_id: "mod-1" },
      { tokens_in: undefined, model_id: "mod-2" },
      { tokens_in: 0, model_id: "mod-3" },
    ];
    const res = computeUnmatchedBreakdown(runs, pricing, aliases);
    expect(res).toEqual({ no_alias: 0, no_snapshot: 0, no_tokens: 3 });
  });

  it("categorizes unmapped models with tokens as no_alias", () => {
    const pricing = new Set(["mod-1"]);
    const aliases = new Set(["mod-1"]);
    const runs = [{ tokens_in: 1000, model_id: "mod-unmapped" }];
    const res = computeUnmatchedBreakdown(runs, pricing, aliases);
    expect(res).toEqual({ no_alias: 1, no_snapshot: 0, no_tokens: 0 });
  });

  it("categorizes aliased models without pricing snapshots as no_snapshot", () => {
    const pricing = new Set(["mod-1"]);
    const aliases = new Set(["mod-1", "mod-2"]);
    const runs = [{ tokens_in: 5000, model_id: "mod-2" }];
    const res = computeUnmatchedBreakdown(runs, pricing, aliases);
    expect(res).toEqual({ no_alias: 0, no_snapshot: 1, no_tokens: 0 });
  });

  it("correctly partitions a mixed set of runs", () => {
    const pricing = new Set(["mod-1"]);
    const aliases = new Set(["mod-1", "mod-2"]);
    const runs = [
      { tokens_in: null, model_id: "mod-1" },
      { tokens_in: 1000, model_id: "mod-2" }, // has alias, no snapshot -> no_snapshot
      { tokens_in: 2000, model_id: "mod-3" }, // no alias -> no_alias
      { tokens_in: 0, model_id: "mod-2" }, // 0 tokens -> no_tokens
    ];
    const res = computeUnmatchedBreakdown(runs, pricing, aliases);
    expect(res).toEqual({ no_alias: 1, no_snapshot: 1, no_tokens: 2 });
  });
});

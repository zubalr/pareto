import { describe, it, expect } from "vitest";
import { calculateNormalizedCost } from "../src/ingest/restate";

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

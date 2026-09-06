import { describe, it, expect } from "vitest";
import {
  selectFinder,
  parsePassAtK,
  effortRank,
  FinderCandidate,
} from "../src/finder";

// The Terminal-Bench 4.0 seed slice (scripts/seed.sql), USD/task = total / 66.
const tbSeed: FinderCandidate[] = [
  { id: "tb1", modelDisplayName: "GPT-5.6 Luna", modelSlug: "gpt-5-6-luna", harnessName: "Codex", harnessVersion: "default", effortPresetSlug: "max", solveRate: 17.3, cost: 300 / 66, costUsdTotal: 300, nSolved: 11, latencyP50Seconds: 14.2, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-luna" },
  { id: "tb2", modelDisplayName: "GPT-5.6 Terra", modelSlug: "gpt-5-6-terra", harnessName: "Codex", harnessVersion: "default", effortPresetSlug: "max", solveRate: 21.5, cost: 1700 / 66, costUsdTotal: 1700, nSolved: 14, latencyP50Seconds: 22.8, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-terra" },
  { id: "tb3", modelDisplayName: "GPT-5.6 Sol", modelSlug: "gpt-5-6-sol", harnessName: "Codex", harnessVersion: "default", effortPresetSlug: "max", solveRate: 37.3, cost: 2500 / 66, costUsdTotal: 2500, nSolved: 25, latencyP50Seconds: 35.1, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-sol" },
  { id: "tb4", modelDisplayName: "GLM-5.3", modelSlug: "glm-5-3", harnessName: "Claude Code", harnessVersion: "default", effortPresetSlug: "max", solveRate: 41.8, cost: 2700 / 66, costUsdTotal: 2700, nSolved: 28, latencyP50Seconds: 38.6, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-glm53" },
  { id: "tb5", modelDisplayName: "Opus 5", modelSlug: "claude-opus-5", harnessName: "Claude Code", harnessVersion: "default", effortPresetSlug: "max", solveRate: 51.8, cost: 6000 / 66, costUsdTotal: 6000, nSolved: 34, latencyP50Seconds: 52.4, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-opus5" },
  { id: "tb6", modelDisplayName: "Fable 5", modelSlug: "fable-5", harnessName: "Claude Code", harnessVersion: "default", effortPresetSlug: "max", solveRate: 44.5, cost: 7300 / 66, costUsdTotal: 7300, nSolved: 29, latencyP50Seconds: 61.2, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-fable5" },
  { id: "tb7", modelDisplayName: "Opus 4.8", modelSlug: "claude-opus-4-8", harnessName: "Claude Code", harnessVersion: "default", effortPresetSlug: "max", solveRate: 23.6, cost: 6500 / 66, costUsdTotal: 6500, nSolved: 16, latencyP50Seconds: 49.8, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-opus48" },
  { id: "tb8", modelDisplayName: "Sonnet 5", modelSlug: "claude-sonnet-5", harnessName: "Claude Code", harnessVersion: "default", effortPresetSlug: "max", solveRate: 12.4, cost: 9600 / 66, costUsdTotal: 9600, nSolved: 8, latencyP50Seconds: 31.0, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-sonnet5" },
  { id: "tb9", modelDisplayName: "Grok 4.6", modelSlug: "grok-4-6", harnessName: "Grok Build", harnessVersion: "default", effortPresetSlug: "high", solveRate: 20.3, cost: 3600 / 66, costUsdTotal: 3600, nSolved: 13, latencyP50Seconds: 29.5, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-grok46" },
  { id: "tb10", modelDisplayName: "Grok 4.5", modelSlug: "grok-4-5", harnessName: "Grok Build", harnessVersion: "default", effortPresetSlug: "high", solveRate: 12.4, cost: 2100 / 66, costUsdTotal: 2100, nSolved: 8, latencyP50Seconds: 24.1, sourceName: "Seed Compiled", sourceOfficial: false, sourceRunId: "seed-tb-grok45" },
];

describe("Finder selection", () => {
  it("$50/task cap on TB 4.0 seed: GLM-5.3 wins max-solve, over-budget runs excluded", () => {
    const result = selectFinder(tbSeed, { maxCostPerTask: 50, objective: "max-solve" });

    expect(result.best?.modelDisplayName).toBe("GLM-5.3");
    expect(result.best?.solveRate).toBeCloseTo(41.8, 5);
    expect(result.best?.sourceRunId).toBe("seed-tb-glm53");

    // Alternatives prefer other models: Sol then Terra
    expect(result.alternatives.map((a) => a.modelDisplayName)).toEqual([
      "GPT-5.6 Sol",
      "GPT-5.6 Terra",
    ]);

    // Over budget: Grok 4.6 ($54.55), Opus 4.8, Opus 5, Fable 5, Sonnet 5
    const overBudget = result.excluded.filter((e) => e.reason === "over-budget");
    expect(overBudget.map((e) => e.run.modelDisplayName).sort()).toEqual([
      "Fable 5",
      "Grok 4.6",
      "Opus 4.8",
      "Opus 5",
      "Sonnet 5",
    ]);
    expect(result.eligible).toHaveLength(5);
  });

  it("min-cost-per-resolved objective prefers Luna ($27.27 per resolved task)", () => {
    const result = selectFinder(tbSeed, { maxCostPerTask: 50, objective: "min-cost-per-resolved" });

    expect(result.best?.modelDisplayName).toBe("GPT-5.6 Luna");
    // 300 / 11 resolved
    expect(result.best!.costUsdTotal! / result.best!.nSolved).toBeCloseTo(27.27, 2);
    expect(result.alternatives[0].modelDisplayName).toBe("GLM-5.3"); // 2700/28 = $96.43
  });

  it("runs without cost telemetry are excluded, never assumed in budget", () => {
    const noCost: FinderCandidate = {
      ...tbSeed[0],
      id: "nocost",
      modelSlug: "no-cost",
      cost: null,
      costUsdTotal: null,
    };
    const result = selectFinder([noCost, tbSeed[0]], { maxCostPerTask: 50, objective: "max-solve" });
    expect(result.eligible.map((r) => r.id)).toEqual(["tb1"]);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toBe("no-cost-telemetry");
  });

  it("latency cap excludes unmeasured and over-cap runs", () => {
    const noLatency: FinderCandidate = { ...tbSeed[0], id: "nolat", latencyP50Seconds: null };
    const result = selectFinder([noLatency, tbSeed[3], tbSeed[5]], {
      maxCostPerTask: 500,
      maxLatencyP50Seconds: 45,
      objective: "max-solve",
    });
    expect(result.best?.id).toBe("tb4"); // 38.6s <= 45
    expect(result.excluded.map((e) => e.reason).sort()).toEqual([
      "no-latency-telemetry",
      "over-latency-budget",
    ]);
  });

  it("min-cost-per-resolved marks zero-resolved runs unrankable", () => {
    const zero: FinderCandidate = { ...tbSeed[0], id: "zero", nSolved: 0, solveRate: 0 };
    const result = selectFinder([zero, tbSeed[0]], {
      maxCostPerTask: 50,
      objective: "min-cost-per-resolved",
    });
    expect(result.best?.id).toBe("tb1");
    expect(result.excluded.map((e) => ({ id: e.run.id, reason: e.reason }))).toEqual([
      { id: "zero", reason: "unrankable" },
    ]);
  });

  it("empty slice yields an honest null result", () => {
    const result = selectFinder([], { maxCostPerTask: 50, objective: "max-solve" });
    expect(result.best).toBeNull();
    expect(result.alternatives).toEqual([]);
    expect(result.eligible).toEqual([]);
  });
});

describe("parsePassAtK", () => {
  it("parses numeric k→percent maps in ascending k order", () => {
    expect(parsePassAtK('{"2": 88.0, "1": 52.0}')).toEqual([
      { k: 1, percent: 52 },
      { k: 2, percent: 88 },
    ]);
  });

  it("treats empty, placeholder, and invalid payloads as no data", () => {
    expect(parsePassAtK("")).toEqual([]);
    expect(parsePassAtK("{}")).toEqual([]);
    expect(parsePassAtK("not-json")).toEqual([]);
    expect(parsePassAtK('{"k": "x"}')).toEqual([]);
  });
});

describe("effortRank", () => {
  it("orders low < medium < high < max and bins unknowns last", () => {
    expect(effortRank("low")).toBeLessThan(effortRank("medium"));
    expect(effortRank("medium")).toBeLessThan(effortRank("high"));
    expect(effortRank("high")).toBeLessThan(effortRank("max"));
    expect(effortRank("turbo")).toBe(effortRank("ultra"));
  });
});

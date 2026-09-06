import { describe, it, expect } from "vitest";
import { selectCompareRuns, parseListParam, CompareCandidate } from "../src/compare";
import { buildResourceCompare, pickResourceConfigs, ResourceRun } from "../src/resources";

const runs: CompareCandidate[] = [
  { id: "r1", modelSlug: "glm-5-3", modelDisplayName: "GLM-5.3", solveRate: 41.8 },
  { id: "r2", modelSlug: "gpt-5-6-sol", modelDisplayName: "GPT-5.6 Sol", solveRate: 37.3 },
  { id: "r3", modelSlug: "gpt-5-6-sol", modelDisplayName: "GPT-5.6 Sol", solveRate: 30.0 },
  { id: "r4", modelSlug: "opus-5", modelDisplayName: "Opus 5", solveRate: 51.8 },
];

describe("selectCompareRuns", () => {
  it("resolves ids in request order", () => {
    const sel = selectCompareRuns(runs, ["r4", "r1"], []);
    expect(sel.selected.map((r) => r.id)).toEqual(["r4", "r1"]);
    expect(sel.unknownIds).toEqual([]);
  });

  it("expands slugs to all runs of the model, solve desc", () => {
    const sel = selectCompareRuns(runs, [], ["gpt-5-6-sol"]);
    expect(sel.selected.map((r) => r.id)).toEqual(["r2", "r3"]);
  });

  it("dedupes ids and slug expansion, reports unknowns", () => {
    const sel = selectCompareRuns(runs, ["r1", "nope"], ["glm-5-3", "ghost"]);
    expect(sel.selected.map((r) => r.id)).toEqual(["r1"]);
    expect(sel.unknownIds).toEqual(["nope"]);
    expect(sel.unknownSlugs).toEqual(["ghost"]);
  });

  it("caps at 8 and reports truncation", () => {
    const many: CompareCandidate[] = Array.from({ length: 12 }, (_, i) => ({
      id: `x${i}`,
      modelSlug: "m",
      modelDisplayName: "M",
      solveRate: i,
    }));
    const sel = selectCompareRuns(many, ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8", "x9"], []);
    expect(sel.selected).toHaveLength(8);
    expect(sel.truncated).toBe(true);
  });

  it("empty params select nothing", () => {
    const sel = selectCompareRuns(runs, [], []);
    expect(sel.selected).toEqual([]);
  });
});

describe("parseListParam", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseListParam("a, b,,c ")).toEqual(["a", "b", "c"]);
    expect(parseListParam(undefined)).toEqual([]);
    expect(parseListParam("")).toEqual([]);
  });
});

const resRuns: ResourceRun[] = [
  // cheapest = baseline ($1/task), has tokens + latency
  { id: "base", modelDisplayName: "Cheap", harnessName: "H", effortPresetSlug: "low", solveRate: 10, cost: 1, hasTokens: true, tokensIn: 60, tokensOut: 40, hasLatency: true, latencyP50Seconds: 10 },
  // 3x USD, 2x tokens, no latency telemetry
  { id: "mid", modelDisplayName: "Mid", harnessName: "H", effortPresetSlug: "high", solveRate: 30, cost: 3, hasTokens: true, tokensIn: 100, tokensOut: 20, hasLatency: false, latencyP50Seconds: null },
  // has latency, no tokens
  { id: "big", modelDisplayName: "Big", harnessName: "H2", effortPresetSlug: "max", solveRate: 50, cost: 5, hasTokens: false, tokensIn: null, tokensOut: null, hasLatency: true, latencyP50Seconds: 40 },
];

describe("buildResourceCompare", () => {
  it("baseline is the cheapest costed config at 1.0x across available groups", () => {
    const rc = buildResourceCompare(resRuns);
    expect(rc.baseline?.id).toBe("base");
    const baseCfg = rc.configs.find((c) => c.isBaseline)!;
    expect(baseCfg.usd?.mult).toBe(1);
    expect(baseCfg.tokens?.mult).toBe(1);
    expect(baseCfg.wallclock?.mult).toBe(1);
  });

  it("computes multipliers and omits bars for missing telemetry", () => {
    const rc = buildResourceCompare(resRuns);
    const mid = rc.configs.find((c) => c.run.id === "mid")!;
    expect(mid.usd?.mult).toBe(3);
    expect(mid.tokens?.mult).toBe(1.2); // 120 total vs baseline 100
    expect(mid.wallclock).toBeNull(); // no latency telemetry → no bar

    const big = rc.configs.find((c) => c.run.id === "big")!;
    expect(big.usd?.mult).toBe(5);
    expect(big.tokens).toBeNull(); // hasTokens false → no bar
    expect(big.wallclock?.mult).toBe(4); // 40s vs 10s
  });

  it("suppresses a whole group when the baseline lacks that metric", () => {
    const withoutClock = resRuns.map((r) =>
      r.id === "base" ? { ...r, hasLatency: false, latencyP50Seconds: null } : r
    );
    const rc = buildResourceCompare(withoutClock);
    expect(rc.groups.wallclock).toBe(false);
    expect(rc.notes.some((n) => n.includes("wall-clock group suppressed"))).toBe(true);
    expect(rc.groups.usd).toBe(true);
  });

  it("empty costed slice yields an honest null result", () => {
    const rc = buildResourceCompare([{ ...resRuns[0], cost: null }]);
    expect(rc.baseline).toBeNull();
    expect(rc.configs).toEqual([]);
    expect(rc.notes[0]).toContain("No configuration");
  });
});

describe("pickResourceConfigs", () => {
  it("always keeps the baseline and caps the rest (frontier first)", () => {
    const many: ResourceRun[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      modelDisplayName: `C${i}`,
      harnessName: "H",
      effortPresetSlug: "max",
      solveRate: i,
      cost: 10 + i,
      hasTokens: false,
      tokensIn: null,
      tokensOut: null,
      hasLatency: false,
      latencyP50Seconds: null,
    }));
    many[7].isFrontier = true;
    const picked = pickResourceConfigs(many, 4);
    expect(picked[0].id).toBe("c0"); // cheapest = baseline
    expect(picked).toHaveLength(4);
    expect(picked.slice(1).map((p) => p.id)).toEqual(["c7", "c9", "c8"]); // frontier first, then solve desc
  });
});

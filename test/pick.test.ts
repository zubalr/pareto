import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  pickFromCandidates,
  comparableCodingSlice,
  snapshotCandidates,
  pickSliceCandidates,
  costSemantics,
  DOMAIN_BOARD,
  DEFAULT_FLOOR,
  PICK_DOMAINS,
  type PickDomain,
} from "../src/pick";
import type { FinderCandidate } from "../src/finder";
import { DEFAULT_THEME_PREF, getThemePref } from "../src/theme";

// ---------------------------------------------------------------------------
// Fixture: REAL rows from the live DeepSWE 1.1 slice (production D1, ids and
// values as ingested from the official DeepSWE leaderboard — nothing faked).
// Grain: benchmark version × model × harness version × effort preset → run.
// ---------------------------------------------------------------------------
function dsRun(
  id: string,
  slug: string,
  name: string,
  effort: string,
  solveRate: number,
  cost: number,
  nSolved: number
): FinderCandidate {
  return {
    id,
    sourceRunId: `mini_swe_agent_${slug}_${effort}`,
    modelDisplayName: name,
    modelSlug: slug,
    harnessName: "mini-SWE-agent",
    harnessVersion: "default",
    effortPresetSlug: effort,
    solveRate,
    cost,
    costUsdTotal: (cost * 113) / 1,
    nSolved,
    nTotal: 113,
    latencyP50Seconds: null,
    sourceName: "DeepSWE Leaderboard",
    sourceOfficial: true,
  };
}

// ids are the real production run ids
const DEEPSWE: FinderCandidate[] = [
  dsRun("01J8RUNDS36EFB5A8MINISWEAG", "gpt-6-astra", "GPT-6 Astra", "xhigh", 74.1, 6.52, 83),
  dsRun("01J8RUNDS6512233CMINISWEAG", "claude-opus-5", "Opus 5", "max", 73.6, 11.84, 83),
  dsRun("01J8RUNDS5B5ECB9DMINISWEAG", "gpt-5-6-luna", "GPT-5.6 Luna", "max", 67.2, 3.03, 76),
  dsRun("01J8RUNDS590D5CB6MINISWEAG", "glm-5-3", "GLM-5.3", "max", 69.0, 3.99, 78),
  dsRun("01J8RUNDS6314BEDBMINISWEAG", "glm-5-3-flash", "GLM-5.3 Flash", "max", 63.4, 0.48, 72),
  dsRun("01J8RUNDS0C06BC77MINISWEAG", "deepseek-v4-pro", "DeepSeek V4 Pro", "max", 62.8, 0.24, 71),
  dsRun("01J8RUNDS008CD10CMINISWEAG", "deepseek-v4-flash", "DeepSeek V4 Flash", "max", 53.3, 0.1, 60),
];

describe("Pick — coding ranker on live-D1-shaped DeepSWE slice", () => {
  it("$2 budget / 50% floor / best-under-budget returns the real GLM-5.3 Flash run", () => {
    const slice = comparableCodingSlice(DEEPSWE, "agentic");
    // agentic slice is matched at max effort — the xhigh Astra row is out
    expect(slice.some((c) => c.effortPresetSlug === "xhigh")).toBe(false);
    const answer = pickFromCandidates(slice, { budget: 2, floor: 50, objective: "best" });
    expect(answer.best).not.toBeNull();
    expect(answer.best!.id).toBe("01J8RUNDS6314BEDBMINISWEAG");
    expect(answer.best!.modelSlug).toBe("glm-5-3-flash");
    expect(answer.best!.effortPresetSlug).toBe("max");
    expect(answer.best!.solveRate).toBeGreaterThanOrEqual(50);
    expect(answer.best!.cost!).toBeLessThanOrEqual(2);
  });

  it("cheaper alternative and over-budget step are the real runs, same bench/effort", () => {
    const slice = comparableCodingSlice(DEEPSWE, "agentic");
    const answer = pickFromCandidates(slice, { budget: 2, floor: 50, objective: "best" });
    expect(answer.cheaper!.id).toBe("01J8RUNDS008CD10CMINISWEAG"); // DeepSeek V4 Flash $0.10
    expect(answer.cheaper!.cost!).toBeLessThan(answer.best!.cost!);
    expect(answer.strongerOverBudget!.id).toBe("01J8RUNDS5B5ECB9DMINISWEAG"); // Luna 67.2 @ $3.03
    expect(answer.strongerOverBudget!.cost!).toBeGreaterThan(2);
    expect(answer.strongerOverBudget!.solveRate).toBeGreaterThan(answer.best!.solveRate);
    // no xhigh sibling for GLM-5.3 Flash on this bench
    expect(answer.upgrade).toBeNull();
  });

  it("cheapest-at-floor objective crowns the cheapest run clearing the floor", () => {
    const slice = comparableCodingSlice(DEEPSWE, "agentic");
    const answer = pickFromCandidates(slice, {
      budget: 2,
      floor: 50,
      objective: "cheapest-floor",
    });
    expect(answer.best!.id).toBe("01J8RUNDS008CD10CMINISWEAG");
  });

  it("floor is a hard filter: below-floor runs are never the answer", () => {
    const answer = pickFromCandidates(DEEPSWE, { budget: 50, floor: 70, objective: "best" });
    expect(answer.best!.solveRate).toBeGreaterThanOrEqual(70);
    expect(answer.omitted.belowFloor).toBeGreaterThan(0);
  });

  it("unlimited budget lifts the cap but still requires positive cost", () => {
    const slice = comparableCodingSlice(DEEPSWE, "agentic");
    const answer = pickFromCandidates(slice, { budget: null, floor: 0, objective: "best" });
    expect(answer.best!.id).toBe("01J8RUNDS6512233CMINISWEAG"); // Opus 5 max, best solve
  });
});

describe("Pick — snapshot domains and the price-proxy rule", () => {
  it("costSemantics: coding is $/task; snapshot domains are labeled proxies", () => {
    expect(costSemantics("coding")).toMatchObject({ unit: "$/task", proxy: false });
    for (const d of ["general", "math", "science"] as PickDomain[]) {
      const cs = costSemantics(d);
      expect(cs.proxy).toBe(true);
      expect(cs.unit).not.toContain("task");
      expect(cs.label).toMatch(/price proxy/i);
    }
  });

  it("every domain maps to a fixed board and the floor defaults are per-domain", () => {
    expect(DOMAIN_BOARD.coding).toMatchObject({ primary: "DeepSWE 1.1", basis: "live-d1" });
    expect(DOMAIN_BOARD.general).toMatchObject({ primary: "MMLU-Pro", basis: "snapshot" });
    expect(DOMAIN_BOARD.math).toMatchObject({ primary: "AIME 2025" });
    expect(DOMAIN_BOARD.science).toMatchObject({ primary: "SciCode" });
    expect(DEFAULT_FLOOR).toMatchObject({ coding: 50, general: 60, math: 40, science: 40 });
    expect(PICK_DOMAINS).toHaveLength(4);
  });

  it("snapshot candidates exist for all four boards with stable ids and no plotted zeros", () => {
    for (const bench of ["mmlu-pro", "aime-2025", "scicode", "gpqa-diamond"] as const) {
      const cands = snapshotCandidates(bench);
      expect(cands.length).toBeGreaterThan(0);
      for (const c of cands) {
        expect(c.id).toBe(`compiled:${bench}:${c.modelSlug}`);
        // cost is either a positive proxy price or absent — never 0
        if (c.cost !== null) expect(c.cost).toBeGreaterThan(0);
      }
    }
    // science sub-intent switches the board
    const sci = pickSliceCandidates("science");
    const gpqa = pickSliceCandidates("science", "gpqa");
    expect(gpqa.length).toBeGreaterThan(0);
    expect(gpqa.map((c) => c.id).sort()).not.toEqual(sci.map((c) => c.id).sort());
  });

  it("unpriced snapshot rows are omitted by budget filtering, never coerced to $0", () => {
    const cands = snapshotCandidates("aime-2025");
    // below-floor rows are pre-filtered before budget eligibility applies
    const unpriced = cands.filter((c) => c.cost === null && c.solveRate >= 40);
    const answer = pickFromCandidates(cands, { budget: 5, floor: 40, objective: "best" });
    expect(answer.omitted.noPrice).toBe(unpriced.length);
    expect(unpriced.length).toBeGreaterThan(0);
    if (answer.best) expect(answer.best.cost).not.toBeNull();
  });

  it("snapshot answers are ranked by score with a proxy budget cap", () => {
    const gen = snapshotCandidates("mmlu-pro");
    const answer = pickFromCandidates(gen, { budget: 5, floor: 60, objective: "best" });
    expect(answer.best).not.toBeNull();
    expect(answer.best!.solveRate).toBeGreaterThanOrEqual(60);
    expect(answer.best!.cost!).toBeLessThanOrEqual(5);
    // best = highest scorer among priced rows under the cap
    const expected = gen
      .filter((c) => c.cost !== null && c.cost <= 5 && c.solveRate >= 60)
      .sort((a, b) => b.solveRate - a.solveRate || (a.cost! - b.cost!) || (a.id < b.id ? -1 : 1))[0];
    expect(answer.best!.id).toBe(expected.id);
  });
});

describe("Pick — theme default", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("the product default is light, with no stored preference", () => {
    expect(DEFAULT_THEME_PREF).toBe("light");
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
      dispatchEvent: () => true,
    });
    vi.stubGlobal("document", { documentElement: { classList: { toggle: () => {} }, style: {} } });
    // no stored pref → light, even if the OS prefers dark
    expect(getThemePref()).toBe("light");
  });
});

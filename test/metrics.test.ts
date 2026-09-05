import { describe, it, expect } from "vitest";
import { dominate, knee, Point } from "../src/metrics";

interface TestRun extends Point {
  name: string;
  harness: string;
  effort: string;
  totalUsd: number | null;
  solveRate: number;
}

describe("Metrics Module", () => {
  it("golden fixture: handles empty set", () => {
    const result = dominate<TestRun>([]);
    expect(result.frontier).toEqual([]);
    expect(result.dominated).toEqual([]);
    expect(knee(result.frontier)).toBeNull();
  });

  it("golden fixture: handles single point", () => {
    const p: TestRun = {
      id: "1",
      name: "Sol",
      harness: "Codex",
      effort: "max",
      cost: 2500,
      totalUsd: 2500,
      solveRate: 37.3,
    };
    const result = dominate([p]);
    expect(result.frontier).toHaveLength(1);
    expect(result.frontier[0].name).toBe("Sol");
    expect(result.dominated).toHaveLength(0);
    expect(knee(result.frontier)?.name).toBe("Sol");
  });

  it("golden fixture: clearly dominated interior point", () => {
    const p1: TestRun = {
      id: "1",
      name: "Efficient",
      harness: "H1",
      effort: "max",
      cost: 100,
      totalUsd: 100,
      solveRate: 50.0,
    };
    const pDominated: TestRun = {
      id: "2",
      name: "Interior Dominated",
      harness: "H2",
      effort: "max",
      cost: 200, // higher cost
      totalUsd: 200,
      solveRate: 40.0, // lower solve
    };
    const p3: TestRun = {
      id: "3",
      name: "High End",
      harness: "H1",
      effort: "max",
      cost: 300,
      totalUsd: 300,
      solveRate: 70.0,
    };

    const result = dominate([p1, pDominated, p3]);
    expect(result.frontier.map((p) => p.name)).toEqual(["Efficient", "High End"]);
    expect(result.dominated.map((p) => p.name)).toEqual(["Interior Dominated"]);
  });

  it("golden fixture: Terminal-Bench 4.0 slice dominates correctly and knee is GLM-5.3", () => {
    const tbTasks = 66;
    const seedTBPoints: TestRun[] = [
      { id: "1", name: "GPT-5.6 Luna", harness: "Codex", effort: "max", totalUsd: 300, cost: 300 / tbTasks, solveRate: 17.3 },
      { id: "2", name: "GPT-5.6 Terra", harness: "Codex", effort: "max", totalUsd: 1700, cost: 1700 / tbTasks, solveRate: 21.5 },
      { id: "3", name: "GPT-5.6 Sol", harness: "Codex", effort: "max", totalUsd: 2500, cost: 2500 / tbTasks, solveRate: 37.3 },
      { id: "4", name: "GLM-5.3", harness: "Claude Code", effort: "max", totalUsd: 2700, cost: 2700 / tbTasks, solveRate: 41.8 },
      { id: "5", name: "Opus 5", harness: "Claude Code", effort: "max", totalUsd: 6000, cost: 6000 / tbTasks, solveRate: 51.8 },
      { id: "6", name: "Fable 5", harness: "Claude Code", effort: "max", totalUsd: 7300, cost: 7300 / tbTasks, solveRate: 44.5 },
      { id: "7", name: "Opus 4.8", harness: "Claude Code", effort: "max", totalUsd: 6500, cost: 6500 / tbTasks, solveRate: 23.6 },
      { id: "8", name: "Sonnet 5", harness: "Claude Code", effort: "max", totalUsd: 9600, cost: 9600 / tbTasks, solveRate: 12.4 },
      { id: "9", name: "Grok 4.6", harness: "Grok Build", effort: "high", totalUsd: 3600, cost: 3600 / tbTasks, solveRate: 20.3 },
      { id: "10", name: "Grok 4.5", harness: "Grok Build", effort: "high", totalUsd: 2100, cost: 2100 / tbTasks, solveRate: 12.4 },
    ];

    // Using USD/task (cost)
    const resultPerTask = dominate(seedTBPoints);
    const frontierNames = resultPerTask.frontier.map((p) => p.name);
    expect(frontierNames).toEqual([
      "GPT-5.6 Luna",
      "GPT-5.6 Terra",
      "GPT-5.6 Sol",
      "GLM-5.3",
      "Opus 5",
    ]);

    const dominatedNames = resultPerTask.dominated.map((p) => p.name);
    expect(dominatedNames).toContain("Grok 4.5");
    expect(dominatedNames).toContain("Grok 4.6");
    expect(dominatedNames).toContain("Opus 4.8");
    expect(dominatedNames).toContain("Fable 5");
    expect(dominatedNames).toContain("Sonnet 5");

    // Knee assertion required by specification:
    // Knee on the TB slice should land on GLM-5.3 (highest solve under the steep cost jump to Opus 5)
    const kneePerTask = knee(resultPerTask.frontier);
    expect(kneePerTask).not.toBeNull();
    expect(kneePerTask?.name).toBe("GLM-5.3");

    // Also assert with total USD
    const resultTotal = dominate(seedTBPoints, {
      getCost: (p) => p.totalUsd,
    });
    expect(resultTotal.frontier.map((p) => p.name)).toEqual([
      "GPT-5.6 Luna",
      "GPT-5.6 Terra",
      "GPT-5.6 Sol",
      "GLM-5.3",
      "Opus 5",
    ]);
    const kneeTotal = knee(resultTotal.frontier, {
      getCost: (p) => p.totalUsd,
    });
    expect(kneeTotal?.name).toBe("GLM-5.3");
  });

  it("handles points with missing or null cost by moving them to dominated/omitted", () => {
    const points: TestRun[] = [
      { id: "1", name: "P1", harness: "H1", effort: "max", totalUsd: 100, cost: 100, solveRate: 30 },
      { id: "2", name: "No Cost", harness: "H1", effort: "max", totalUsd: null, cost: null, solveRate: 40 },
    ];
    const result = dominate(points);
    expect(result.frontier.map((p) => p.name)).toEqual(["P1"]);
    expect(result.dominated.map((p) => p.name)).toEqual(["No Cost"]);
  });
});

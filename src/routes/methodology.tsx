import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-8 text-zinc-300">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight">
          PARETO FRONTIER METHODOLOGY &amp; POLICIES
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Formulas, provenance, canary assertions, and platform scope constraints.
        </p>
      </div>

      {/* 1. Mathematical Formulas */}
      <section className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider text-emerald-400">
          1. Mathematical Definitions
        </h2>

        <div>
          <h3 className="font-semibold text-xs text-zinc-200">A. Pareto Dominance</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Let each configuration point be defined as <code className="text-zinc-200">P = (Cost, SolveRate)</code>, where we seek to <em>minimize</em> cost (USD/task) and <em>maximize</em> solve rate (%).
          </p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Configuration <code className="text-zinc-200">A</code> <strong>dominates</strong> configuration <code className="text-zinc-200">B</code> (<code className="text-zinc-200">A ≻ B</code>) if and only if:
          </p>
          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300 my-2">
            Cost(A) ≤ Cost(B) ∧ SolveRate(A) ≥ SolveRate(B) ∧ (Cost(A) &lt; Cost(B) ∨ SolveRate(A) &gt; SolveRate(B))
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The <strong>Pareto Frontier</strong> is the set of all undominated configurations in a single benchmark version. Points lacking cost telemetry are omitted from scatter rendering.
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200">B. Knee Identification (Kneedle Chord Method)</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Along the sorted Pareto frontier, from the cheapest point <code className="text-zinc-200">P_min</code> to the highest-solving point <code className="text-zinc-200">P_max</code>, coordinates are normalized to the unit square <code className="text-zinc-200">[0, 1]²</code>:
          </p>
          <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300 my-2">
            x_norm = (Cost - Cost_min) / (Cost_max - Cost_min)<br />
            y_norm = (SolveRate - SolveRate_min) / (SolveRate_max - SolveRate_min)<br />
            Perpendicular Distance d = (y_norm - x_norm) / √2
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The <strong>Knee</strong> is defined as the frontier configuration achieving the maximum perpendicular distance above the chord line connecting <code className="text-zinc-200">(0, 0)</code> to <code className="text-zinc-200">(1, 1)</code>. This represents the point of diminishing returns—the optimal trade-off before exponential cost increases.
          </p>
        </div>

        <div className="pt-2 border-t border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200">C. Denominator Invariant</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Solve rate is strictly calculated against the full suite benchmark size (<code className="text-zinc-200">n_tasks</code>), never merely against attempted tasks. Incomplete runs are treated as zero solve for unfinished tasks.
          </p>
        </div>
      </section>

      {/* 2. Seed Provenance */}
      <section className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider text-cyan-400">
          2. Seed Data Provenance
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The initial data points seeded into D1 are compiled illustrative points from public benchmark leaderboards and eval reports. They are flagged with <code className="text-zinc-200">source: seed-compiled</code> and <code className="text-zinc-200">official: 0</code>.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          For Terminal-Bench 4.0 (66 tasks), USD per task is derived as <code className="text-zinc-200">listed_total_usd / 66</code>.
        </p>
      </section>

      {/* 3. Canary Assertion */}
      <section className="bg-zinc-950 border border-amber-500/30 rounded p-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-amber-400 font-mono uppercase tracking-wider">
          3. Benchmark Integrity &amp; Canary Note
        </h2>
        <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded text-xs text-amber-200/90 leading-relaxed">
          <strong>Strict Isolation Policy:</strong> Benchmark task prompts, statements, test cases, and solutions (especially Terminal-Bench and SWE-bench task texts) must <strong>never</strong> be copied, stored, or committed to this repository. This application stores only aggregate metrics and configurations.
        </div>
      </section>

      {/* 4. What This Site Is Not */}
      <section className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider text-zinc-300">
          4. Scope &amp; Non-Goals
        </h2>
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li><strong>Not an official leaderboard:</strong> We do not conduct primary evals; this dashboard computes cost-versus-accuracy frontiers from reported data.</li>
          <li><strong>Not a harness runner:</strong> Execution happens externally in standardized harnesses (Codex, Claude Code, etc.).</li>
          <li><strong>No opinionated recommenders:</strong> The frontier and knee are purely geometric and mathematical, without subjective weighting or promotional bias.</li>
        </ul>
      </section>
    </div>
  );
}

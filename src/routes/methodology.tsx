import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

function Section({
  n,
  title,
  accent,
  children,
}: {
  n: string;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded p-4 flex flex-col gap-3">
      <h2 className={`text-sm font-bold font-mono uppercase tracking-wider ${accent}`}>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300 my-1 overflow-x-auto">
      {children}
    </div>
  );
}

function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 pb-10 flex flex-col gap-6 text-zinc-300">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight">
          METHODOLOGY
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          What one point on the Explorer board means, how the frontier and knee are computed, where
          the seed numbers come from, and what this site is not. Written to be checked, not to
          impress.
        </p>
      </div>

      {/* 1. Grain of a run */}
      <Section n="1" title="Grain of a run" accent="text-zinc-100">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Every point on the scatter is one <strong>configuration run</strong>: the cross product of
        </p>
        <Formula>
          benchmark version × model × provider × harness version × effort preset → one source run
        </Formula>
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Benchmark version</strong> — e.g. Terminal-Bench 4.0 (66 tasks). Points from
            different benchmark versions are never plotted together; the benchmark selector is
            single-choice and required.
          </li>
          <li>
            <strong>Harness version</strong> — the agent harness (Codex, Claude Code, Grok Build)
            and its version string. A model is only comparable across points that share a harness
            version; differing harness versions are shown, not merged.
          </li>
          <li>
            <strong>Effort preset</strong> — the reasoning-effort setting (low / medium / high /
            max) requested for the run. The same model at different efforts is a different point.
          </li>
          <li>
            Each run keeps a <code className="text-zinc-200">source_run_id</code> pointing at the
            upstream record, so an aggregate number can be traced back to its origin.
          </li>
        </ul>
      </Section>

      {/* 2. Metrics */}
      <Section n="2" title="Solve rate & cost metrics" accent="text-emerald-400">
        <div>
          <h3 className="font-semibold text-xs text-zinc-200">A. Solve rate denominator</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Solve rate is always computed against the full suite size{" "}
            <code className="text-zinc-200">n_tasks</code>, never against attempted tasks:
          </p>
          <Formula>solve_rate = n_solved / n_tasks × 100</Formula>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Unattempted, errored, or timed-out tasks count as unsolved. A run that crashed after 10
            of 66 tasks reports <code className="text-zinc-200">n_solved</code> over 66, not over
            10. This makes partial runs honest: they cannot flatter a model by shrinking the
            denominator.
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200">B. Cost per task</h3>
          <Formula>usd_per_task = cost_usd_total / n_tasks</Formula>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Two bases are tracked: <strong>Reported</strong> (priced as published with the original
            run — the primary number) and <strong>Today</strong> (re-priced at current list rates
            from the <code className="text-zinc-200">pricing_snapshots</code> table). A run without
            a normalized price is <strong>omitted from Today-basis views</strong> and the table
            shows "not restated" — Today never substitutes Reported, and a missing price is never
            drawn as $0.
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200">C. Cost per resolved task</h3>
          <Formula>usd_per_resolved = cost_usd_total / n_solved</Formula>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The "amortized" number vendors like to quote. It is shown in the table for
            transparency, but it is <em>not</em> a chart axis: it hides failures by dividing them
            out. Sort by it, but read it next to solve rate.
          </p>
        </div>
      </Section>

      {/* 3. Coverage flags */}
      <Section n="3" title="Coverage flags — missing is never zero" accent="text-amber-400">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Telemetry gaps are recorded as explicit boolean flags on every run:
          <code className="text-zinc-200 mx-1">hasTokens</code>
          <code className="mx-1 text-zinc-200">hasCost</code>
          <code className="mx-1 text-zinc-200">hasLatency</code>
          <code className="mx-1 text-zinc-200">hasPassAtK</code>
          <code className="text-zinc-200">hasCi</code>. They appear as quiet chips in the table and
          tooltip — a missing chip means the datum does not exist, not that it was zero.
        </p>
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            A run without cost (<code className="text-zinc-200">hasCost = 0</code> or null cost) is{" "}
            <strong>excluded from the frontier calculation and omitted from the scatter</strong>. It
            is never drawn at $0, which would falsely crown it "cheapest".
          </li>
          <li>
            The same rule applies to any future encoding: a run missing latency is omitted from
            latency charts, a run without a pass@k curve from pass@k charts.
          </li>
        </ul>
      </Section>

      {/* 4. Frontier & knee */}
      <Section n="4" title="Pareto frontier & knee" accent="text-cyan-400">
        <div>
          <h3 className="font-semibold text-xs text-zinc-200">A. Domination rule</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Each point is <code className="text-zinc-200">P = (cost, solve_rate)</code>; cost is
            minimized, solve rate maximized. Configuration <code className="text-zinc-200">A</code>{" "}
            dominates <code className="text-zinc-200">B</code> iff:
          </p>
          <Formula>
            Cost(A) ≤ Cost(B) ∧ Solve(A) ≥ Solve(B) ∧ (Cost(A) &lt; Cost(B) ∨ Solve(A) &gt;
            Solve(B))
          </Formula>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The <strong>frontier</strong> is the set of undominated points within one benchmark
            version. Equal-cost-and-equal-solve duplicates do not dominate each other and both stay
            on the frontier. Only runs with positive cost participate.
          </p>
        </div>
        <div className="pt-2 border-t border-zinc-800/80">
          <h3 className="font-semibold text-xs text-zinc-200">B. Knee rule (Kneedle chord method)</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Frontier points are sorted by cost ascending and normalized to the unit square against
            the cheapest and highest-solving frontier points:
          </p>
          <Formula>
            x = (Cost − Cost_min) / (Cost_max − Cost_min)<br />
            y = (Solve − Solve_min) / (Solve_max − Solve_min)<br />
            d = (y − x) / √2
          </Formula>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The <strong>knee</strong> is the frontier point maximizing the perpendicular distance{" "}
            <code className="text-zinc-200">d</code> above the unit diagonal — the point of
            diminishing returns where the next dollar buys visibly less solve. It is a geometric
            property of the current slice: filter the board and the knee moves with it. For the
            default Terminal-Bench 4.0 seed the knee lands on GLM-5.3 (Claude Code · max).
          </p>
        </div>
      </Section>

      {/* 5. Finder */}
      <Section n="5" title="The Finder — a deterministic budget filter" accent="text-cyan-400">
        <p className="text-xs text-zinc-400 leading-relaxed">
          <Link to="/finder" className="underline hover:text-zinc-300">
            /finder
          </Link>{" "}
          applies <em>your</em> constraint to one benchmark version and states exactly what it did.
          It never interpolates, scores, or weights — it filters and ranks:
        </p>
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Eligibility:</strong> a run qualifies only with reported cost ≤ your $/task cap
            (Reported basis). A run without cost telemetry is excluded as unverifiable — it is
            never assumed within budget.
          </li>
          <li>
            <strong>Latency cap (optional):</strong> a run must have a measured p50 ≤ cap. Unmeasured
            latency is excluded while a cap is set, for the same reason.
          </li>
          <li>
            <strong>Objectives:</strong> <code className="text-zinc-200">max solve rate</code> ranks
            eligible runs by solve rate; <code className="text-zinc-200">min $/resolved</code> ranks
            by total cost ÷ resolved tasks (needs n_solved &gt; 0). Ties break on cost, then run id —
            the output is deterministic and reproducible from the URL.
          </li>
          <li>
            <strong>Output:</strong> the actual winning run (id, config, provenance), up to two
            alternatives (different models preferred, same ranking rule), and a ledger of every
            excluded run with its reason.
          </li>
        </ul>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Worked example on the default seed: a $50/task cap on Terminal-Bench 4.0 excludes 5 of 10
          runs for budget (Grok 4.6 sits just over at $54.55/task); GLM-5.3 wins max-solve at 41.8%
          ($40.91/task), with GPT-5.6 Sol and Terra as alternatives. Switching the objective to
          min $/resolved instead crowns GPT-5.6 Luna at $27.27 per resolved task — a reminder that
          $/resolved rewards cheap partial success and must be read next to solve rate.
        </p>
      </Section>

      {/* 6. Seed provenance */}
      <Section n="6" title="Seed data provenance" accent="text-zinc-100">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Every seeded run is sourced from <code className="text-zinc-200">seed-compiled</code>{" "}
          with <code className="text-zinc-200">official = 0</code>: aggregate numbers hand-compiled
          from public leaderboards and eval reports to bootstrap the app. They are illustrative, not
          audited.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          For Terminal-Bench 4.0 (66 tasks), USD per task is derived as{" "}
          <code className="text-zinc-200">listed_total_usd / 66</code>. SWE-bench Verified seed rows
          use a synthetic 500-task slice constructed the same way. Ingest plans for first-party
          sources (Aider polyglot YAML, OpenRouter model metadata, Harbor/Terminal-Bench submission
          JSON, SWE-bench experiments) are catalogued in{" "}
          <code className="text-zinc-200">docs/sources.md</code>; until those adapters run, this
          board is a fixture.
        </p>
      </Section>

      {/* 7. Canary */}
      <Section n="7" title="Benchmark integrity & canary" accent="text-amber-400">
        <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded text-xs text-amber-200/90 leading-relaxed">
          <strong>Strict isolation policy:</strong> benchmark task prompts, statements, test cases,
          and solutions — especially Terminal-Bench and SWE-bench task text — must never be copied,
          stored, or committed to this repository. Only aggregate metrics and configuration
          metadata are cataloged. Upstream Terminal-Bench data carries its own canary GUID; any
          future ingest must preserve canary markings and exclude task bodies from fetched payloads
          before they touch this codebase.
        </div>
      </Section>

      {/* 8. Scope */}
      <Section n="8" title="What this site is not" accent="text-zinc-100">
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Not an official leaderboard.</strong> We run no primary evaluations. The board
            computes cost-versus-accuracy frontiers from reported or compiled aggregates, and the
            banner says so on every page.
          </li>
          <li>
            <strong>Not a harness runner.</strong> Execution happens externally in standard
            harnesses; this app only catalogs results.
          </li>
          <li>
            <strong>Not a subjective recommender.</strong> The frontier and knee are purely
            geometric, and the Finder is a transparent budget filter with a stated ranking rule (§5)
            — no editorial weighting, sponsored placement, or "best model" badge exists.
          </li>
          <li>
            <strong>Not a cross-benchmark comparison tool.</strong> One benchmark version per
            chart, by construction. Solve rates on different suites measure different things.
          </li>
        </ul>
        <p className="text-xs text-zinc-500 leading-relaxed pt-1">
          Design decisions for the Explorer (encodings, color rules, future chart specs) are
          recorded in <code className="text-zinc-400">DESIGN.md</code>.
        </p>
      </Section>

      <p className="text-[11px] text-zinc-600">
        Questions or corrections: open an issue against the repo.{" "}
        <Link to="/" className="underline hover:text-zinc-400">
          ← Back to Explorer
        </Link>
      </p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/methodology")({
  head: () => ({ title: "Methodology · Pareto" }),
  component: MethodologyPage,
});

function Section(
  {
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
            <strong>Benchmark version</strong> — e.g. DeepSWE 1.1 (113 tasks) or Terminal-Bench 4.0
            (66 tasks). Points from different benchmark versions are never plotted together; the
            benchmark selector is single-choice and required.
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
            property of the current slice: filter the board (or switch cost basis or match an
            effort preset) and the knee moves with it. On the default DeepSWE 1.1 board
            (Reported basis) the knee lands on DeepSeek V4 Pro (mini-SWE-agent · max · $0.24/task ·
            62.8%); switching to Today re-computes it over restated prices only.
          </p>
        </div>
      </Section>

      {/* 5. Pick */}
      <Section n="5" title="Pick — domain, budget, one answer" accent="text-emerald-400">
        <p className="text-xs text-zinc-400 leading-relaxed">
          <Link to="/" className="underline hover:text-zinc-300">
            /
          </Link>{" "}
          is Pick: you say <strong>what you are doing</strong> (domain) and{" "}
          <strong>what you can spend</strong> (budget), and the page answers with{" "}
          <strong>one configuration</strong> — model, effort preset, harness (if agentic), expected
          score, cost, provenance, and why — plus one cheaper alternative and one stronger
          over-budget option. Pick is a recommendation layer over the same data as the Explorer; it
          never forks the ranker: selection is the Finder's deterministic rules (§6) applied to one
          domain slice, with the quality floor applied as a hard filter before ranking.
        </p>
        <div>
          <h3 className="font-semibold text-xs text-zinc-200">
            Freshness law (Phase 12): only boards updated in the last 6 months
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed mt-1">
            Models move every week; a stale board is a museum. Pick and the Explorer selector
            carry <strong>only boards whose upstream leaderboard last published on/after{" "}
            <code className="text-zinc-200">{`2026-03-08`}</code></strong>{" "}
            and that are not frozen, deprecated, superseded, or retired-as-saturated. The verdict
            per board — with the dates we verified on 2026-09-08 — lives in{" "}
            <code className="text-zinc-200">src/domains/registry.ts</code>:
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-1">Board</th>
                  <th className="px-2 py-1">Verdict</th>
                  <th className="px-2 py-1">Verified freshness</th>
                  <th className="px-2 py-1">Why</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">DeepSWE 1.1</td>
                  <td className="px-2 py-1.5 text-emerald-400 font-semibold">KEEP</td>
                  <td className="px-2 py-1.5 font-mono">2026-09-07</td>
                  <td className="px-2 py-1.5">leaderboard-live.json Last-Modified; site "updated September 3, 2026"</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">MMLU-Pro (TIGER-Lab)</td>
                  <td className="px-2 py-1.5 text-emerald-400 font-semibold">KEEP</td>
                  <td className="px-2 py-1.5 font-mono">2026-03-11</td>
                  <td className="px-2 py-1.5">last leaderboard update on/after the cutoff (barely — re-checked each compile)</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">AIME 2026 (MathArena)</td>
                  <td className="px-2 py-1.5 text-emerald-400 font-semibold">KEEP</td>
                  <td className="px-2 py-1.5 font-mono">2026-09-08</td>
                  <td className="px-2 py-1.5">live board; replaces the frozen AIME 2025</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">SciCode (Kaggle Open Benchmarks)</td>
                  <td className="px-2 py-1.5 text-emerald-400 font-semibold">KEEP</td>
                  <td className="px-2 py-1.5 font-mono">2026-08-28</td>
                  <td className="px-2 py-1.5">"Last updated August 28, 2026" on the public page</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">SWE-bench Verified</td>
                  <td className="px-2 py-1.5 text-emerald-400 font-semibold">KEEP</td>
                  <td className="px-2 py-1.5 font-mono">2026-09-03</td>
                  <td className="px-2 py-1.5">experiments repo still receiving commits into September 2026</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">AIME 2025 (MathArena)</td>
                  <td className="px-2 py-1.5 text-warn font-semibold">THROW</td>
                  <td className="px-2 py-1.5 font-mono">frozen</td>
                  <td className="px-2 py-1.5">deprecated upstream, superseded by AIME 2026; newer models absent by construction</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">GPQA Diamond</td>
                  <td className="px-2 py-1.5 text-warn font-semibold">THROW</td>
                  <td className="px-2 py-1.5 font-mono">saturated</td>
                  <td className="px-2 py-1.5">retired as saturated (~95% ceiling does not rank new models)</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">Aider Polyglot</td>
                  <td className="px-2 py-1.5 text-warn font-semibold">THROW</td>
                  <td className="px-2 py-1.5 font-mono">2025-10-03</td>
                  <td className="px-2 py-1.5">upstream YAML last gained a row 2025-10-03 (repo commit 2025-10-04) — before the cutoff</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">Harbor TB 2.0</td>
                  <td className="px-2 py-1.5 text-warn font-semibold">THROW</td>
                  <td className="px-2 py-1.5 font-mono">superseded</td>
                  <td className="px-2 py-1.5">current Terminal-Bench family is 4.0; TB 2.0 is frozen</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5">TB 4.0 seed</td>
                  <td className="px-2 py-1.5 text-warn font-semibold">THROW</td>
                  <td className="px-2 py-1.5 font-mono">compiled</td>
                  <td className="px-2 py-1.5">10 hand-compiled fixtures, not a living official board — never relabeled "latest TB 4.0"</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-xs text-zinc-200">Domain → bench map after the law</h3>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-1">Domain</th>
                  <th className="px-2 py-1">Primary board</th>
                  <th className="px-2 py-1">Sub-intents</th>
                  <th className="px-2 py-1">Cost semantics</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5 font-semibold">Coding</td>
                  <td className="px-2 py-1.5">DeepSWE 1.1 (113 tasks, live D1)</td>
                  <td className="px-2 py-1.5">Terminal — honest empty until official TB 4.0 is ingested · GitHub bugs (SWE-bench Verified). Polyglot omitted (stale upstream)</td>
                  <td className="px-2 py-1.5">measured $/task (reported basis)</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5 font-semibold">General</td>
                  <td className="px-2 py-1.5">MMLU-Pro (TIGER-Lab compiled snapshot)</td>
                  <td className="px-2 py-1.5">—</td>
                  <td className="px-2 py-1.5 text-amber-400">list $/M output — price proxy, not $/task</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5 font-semibold">Math</td>
                  <td className="px-2 py-1.5">AIME 2026 (MathArena live board)</td>
                  <td className="px-2 py-1.5">—</td>
                  <td className="px-2 py-1.5 text-amber-400">list $/M output — price proxy</td>
                </tr>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-2 py-1.5 font-semibold">Science</td>
                  <td className="px-2 py-1.5">SciCode (Kaggle Open Benchmarks snapshot)</td>
                  <td className="px-2 py-1.5">— (GPQA Diamond thrown: saturated)</td>
                  <td className="px-2 py-1.5 text-amber-400">list $/M output — price proxy</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Coding answers come from live D1</strong> — the official leaderboard ingests,
            with measured $/task. The agentic slice is matched at <code className="text-zinc-200">max</code>{" "}
            effort so recommendations are comparable; when the same model has an{" "}
            <code className="text-zinc-200">xhigh</code> run it is shown as the separate
            "spend more" step, never mixed into the same sentence as the max answer.
          </li>
          <li>
            <strong>General / math / science come from a compiled, attributed snapshot</strong>{" "}
            (<code className="text-zinc-200">src/data/compiled-domain-scores.ts</code>, retrieved{" "}
            2026-09-08, sources + last-publish dates + licenses inline). It is not refreshed by a
            cron. Snapshot model names are mapped onto existing D1 slugs when the model is
            obviously the same, so a snapshot answer can still link to a D1 dossier. Models that
            only scored on thrown boards (e.g. AIME 2025's frozen roster) are dropped.
          </li>
          <li>
            <strong>The price proxy rule:</strong> snapshot budgets cap the model's OpenRouter{" "}
            <em>list $/M output</em> price — a proxy for spend, never a $/task figure. $/task only
            exists where agent runs measured it (coding). Rows without a list price are{" "}
            <strong>omitted from budget filtering</strong>, never priced at zero.
          </li>
          <li>
            <strong>Ceilings:</strong> AIME 2026's top sits at 100%, so tiny deltas up there are
            noise — the board carries a ceiling note rather than pretending ordering is meaningful.
            SciCode's top (~43%) still differentiates.
          </li>
          <li>
            <strong>Retired ≠ deleted:</strong> old boards may keep rows in D1 and buried{" "}
            <code className="text-zinc-200">?benchmark=</code> URLs still resolve so links don't
            404 — but they never appear in selectors, never default, and never get recommended.
            There is no archive toggle on Pick.
          </li>
          <li>
            <strong>Not an AA index, no AA private evals, no AA scrapes.</strong> Pick never claims
            the Artificial Analysis Intelligence Index (40% of which is private) and never sources
            from AA.
          </li>
        </ul>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Worked examples. Coding (live D1): budget $2/task → floor 50% → best under budget on the
          max-effort DeepSWE 1.1 slice returns <strong>GLM-5.3 Flash</strong> (mini-SWE-agent · max ·
          63.4% · $0.48/task · run{" "}
          <code className="text-zinc-200">01J8RUNDS6314BEDBMINISWEAG</code>), with DeepSeek V4 Flash
          (53.3% · $0.10/task) as the cheaper alternative and GPT-5.6 Luna (67.2% · $3.03/task)
          flagged as the over-budget next step up. Math (snapshot): unlimited budget → floor 40%
          returns <strong>Opus 4.8</strong> (AIME 2026 · max · 100.0%) via the cost tie-break at
          $25/M output list price — the ceiling note applies.
        </p>
      </Section>

      {/* 6. Finder */}
      <Section n="6" title="The Finder — a deterministic budget filter" accent="text-cyan-400">
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
          Worked example on the default board: <code className="text-zinc-200">cheapest-at-floor</code>{" "}
          with a 50% solve floor and a $2/task cap on DeepSWE 1.1 returns{" "}
          <strong>DeepSeek V4 Flash</strong> (mini-SWE-agent · max · 53.3% · $0.10/task · 60/113
          solved), run id{" "}
          <code className="text-zinc-200">01J8RUNDS008CD10CMINISWEAG</code> — with DeepSeek V4 Pro
          ($0.24/task · 62.8%) as the next alternative. Switch the objective to{" "}
          <code className="text-zinc-200">max-solve</code> under the same cap and the answer
          changes; that is the point of stating the rule. On the archived Terminal-Bench 4.0 seed
          slice the same rules crown GLM-5.3 under a $50 cap — seed slices remain queryable and
          labeled as compiled.
        </p>
      </Section>

      {/* 7. Seed provenance */}
      <Section n="7" title="Seed data provenance" accent="text-zinc-100">
        <p className="text-xs text-zinc-400 leading-relaxed">
          The default board (DeepSWE 1.1) — and most slices — are now <strong>official
          ingests</strong>: DeepSWE, Harbor/Terminal-Bench 2.0, the Aider polyglot leaderboard, and
          SWE-bench Verified experiment rows, each carrying <code className="text-zinc-200">official = 1</code>{" "}
          and a <code className="text-zinc-200">sourceRunId</code> pointing at the upstream record.
          Slices mix sources only within one benchmark version, and the banner names the
          composition (compiled vs official counts) on every board.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The <strong>seed archive</strong> remains queryable: the Terminal-Bench 4.0 slice (and a
          few SWE-bench Verified rows) are hand-compiled fixtures from public leaderboards with{" "}
          <code className="text-zinc-200">official = 0</code> — illustrative, not audited, and
          always labeled compiled on the board. For that archive, USD per task is derived as{" "}
          <code className="text-zinc-200">listed_total_usd / n_tasks</code>. Source research,
          licenses, and field mappings for every ingest are catalogued in{" "}
          <code className="text-zinc-200">docs/sources.md</code>.
        </p>
      </Section>

      {/* 7. Canary */}
      <Section n="8" title="Benchmark integrity & canary" accent="text-amber-400">
        <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded text-xs text-amber-200/90 leading-relaxed">
          <strong>Strict isolation policy:</strong> benchmark task prompts, statements, test cases,
          and solutions — especially Terminal-Bench and SWE-bench task text — must never be copied,
          stored, or committed to this repository. Only aggregate metrics and configuration
          metadata are cataloged. Upstream Terminal-Bench data carries its own canary GUID; any
          future ingest must preserve canary markings and exclude task bodies from fetched payloads
          before they touch this codebase.
        </div>
      </Section>

      {/* 9. Scope */}
      <Section n="9" title="What this site is not" accent="text-zinc-100">
        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Not an official leaderboard.</strong> We run no primary evaluations and are not
            an independent evaluation lab — we re-grade nothing ourselves. The board computes
            cost-versus-accuracy frontiers from reported or compiled aggregates, and the banner says
            so on every page.
          </li>
          <li>
            <strong>Not an Artificial Analysis index.</strong> Different scope, different method:
            this is a single-benchmark frontier board over public run aggregates, not a
            cross-vendor quality index. We publish per-run provenance instead of a composite score.
          </li>
          <li>
            <strong>Not a harness runner.</strong> Execution happens externally in standard
            harnesses; this app only catalogs results.
          </li>
          <li>
            <strong>Not a subjective recommender.</strong> The frontier and knee are purely
            geometric, and the Finder and Pick are deterministic filters with stated ranking rules (§5–6)
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

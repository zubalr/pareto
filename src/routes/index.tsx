import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CircleDollarSign,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Sigma,
  SquareCode,
  TrendingUp,
} from "lucide-react";
import { getFinderData, type FinderResponse } from "../server/functions";
import type { FinderCandidate } from "../finder";
import {
  BUDGET_PRESETS,
  CODING_INTENTS,
  DEFAULT_FLOOR,
  DOMAIN_BOARD,
  INTENT_BENCH,
  PICK_DOMAINS,
  comparableCodingSlice,
  costSemantics,
  pickFromCandidates,
  pickSliceCandidates,
  type CodingIntent,
  type PickDomain,
  type PickObjective,
} from "../pick";
import { COMPILED_SOURCES, SNAPSHOT_RETRIEVED } from "../data/compiled-domain-scores";

// ---------------------------------------------------------------------------
// / is Pick (Phase 11): domain → budget → one configuration answer.
// Old Explorer URLs (/?benchmark=…&models=…) redirect to /explore preserving
// every filter param, so pre-Phase-11 links keep working.
// ---------------------------------------------------------------------------

const LEGACY_EXPLORER_KEYS = [
  "benchmark",
  "models",
  "harnesses",
  "efforts",
  "costBasis",
  "pinned",
  "chart",
  "effortMatch",
  "colorBy",
  "density",
] as const;

const searchSchema = z.object({
  domain: z.enum(["coding", "general", "math", "science"]).optional(),
  // coding intents + the science sub-intent (gpqa)
  intent: z.enum(["agentic", "terminal", "polyglot", "github", "gpqa"]).optional(),
  budget: z.string().optional(),
  floor: z.string().optional(),
  objective: z.enum(["best", "cheapest-floor", "min-resolved"]).optional(),
});

const ALL_INTENTS = [...CODING_INTENTS, "gpqa"] as const;

export const Route = createFileRoute("/")({
  head: () => ({ title: "Pick · Pareto" }),
  validateSearch: (search: Record<string, unknown>) => {
    const coerceString = (v: unknown): string | undefined =>
      v === undefined || v === null ? undefined : String(v);
    const out: Record<string, unknown> = {
      domain:
        search.domain === "coding" ||
        search.domain === "general" ||
        search.domain === "math" ||
        search.domain === "science"
          ? search.domain
          : undefined,
      intent: ALL_INTENTS.includes(search.intent as never) ? search.intent : undefined,
      budget: coerceString(search.budget),
      floor: coerceString(search.floor),
      objective:
        search.objective === "cheapest-floor" ||
        search.objective === "min-resolved" ||
        search.objective === "best"
          ? search.objective
          : undefined,
    };
    // Legacy Explorer params pass through validation untouched so beforeLoad
    // can redirect them (with values) to /explore.
    for (const k of LEGACY_EXPLORER_KEYS) {
      if (search[k] !== undefined) out[k] = search[k];
    }
    return out;
  },
  beforeLoad: ({ search }) => {
    const legacy: Record<string, unknown> = {};
    for (const k of LEGACY_EXPLORER_KEYS) {
      if ((search as Record<string, unknown>)[k] !== undefined) {
        legacy[k] = (search as Record<string, unknown>)[k];
      }
    }
    if (Object.keys(legacy).length > 0) {
      throw redirect({ to: "/explore", search: legacy });
    }
  },
  loaderDeps: ({ search }) => ({
    domain: search.domain,
    intent: search.intent ?? "agentic",
  }),
  loader: async ({ deps }): Promise<{ finder: FinderResponse | null }> => {
    if (deps.domain !== "coding") return { finder: null };
    const intent = INTENT_BENCH[(deps.intent as CodingIntent) ?? "agentic"] ?? INTENT_BENCH.agentic;
    const finder = await getFinderData({
      data: {
        benchmarkVersionId: intent.id,
        costBasis: "reported",
        effortMatch: "all",
      },
    });
    return { finder };
  },
  component: PickPage,
});

function fmtMoney(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 1) return `$${v.toFixed(2).replace(/\.00$/, "")}`;
  return `$${v.toFixed(2)}`;
}

const DOMAIN_META: Record<
  PickDomain,
  { title: string; blurb: string; fieldClass: string; icon: React.ReactNode }
> = {
  coding: {
    title: "Coding",
    blurb: "Ship features, fix terminal tasks, close GitHub bugs — real $/task from measured agent runs.",
    fieldClass: "domain-field-coding text-domain-coding",
    icon: <SquareCode size={22} />,
  },
  general: {
    title: "General",
    blurb: "Knowledge and reasoning across subjects (MMLU-Pro). Budget is a list-price proxy.",
    fieldClass: "domain-field-general text-domain-general",
    icon: <Lightbulb size={22} />,
  },
  math: {
    title: "Math",
    blurb: "Competition math (AIME 2025, frozen snapshot). Contest %, not SWE solve rate.",
    fieldClass: "domain-field-math text-domain-math",
    icon: <Sigma size={22} />,
  },
  science: {
    title: "Science",
    blurb: "Research-level scientific coding (SciCode) — and GPQA Diamond, saturated.",
    fieldClass: "domain-field-science text-domain-science",
    icon: <FlaskConical size={22} />,
  },
};

function DomainCard({
  domain,
  active,
  onSelect,
}: {
  domain: PickDomain;
  active: boolean;
  onSelect: (d: PickDomain) => void;
}) {
  const meta = DOMAIN_META[domain];
  const board = DOMAIN_BOARD[domain];
  return (
    <button
      type="button"
      onClick={() => onSelect(domain)}
      aria-pressed={active}
      className={`domain-field ${meta.fieldClass} text-left rounded-lg border p-4 flex flex-col gap-1.5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active ? "ring-2 ring-accent shadow-md bg-surface" : "bg-surface"
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          {meta.icon}
          <span className="text-[28px] leading-8 font-bold text-ink">{meta.title}</span>
        </span>
        <span
          className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
            board.basis === "live-d1"
              ? "bg-emerald-950 text-emerald-400"
              : "bg-amber-950 text-amber-400"
          }`}
        >
          {board.basis === "live-d1" ? "live D1" : "snapshot"}
        </span>
      </span>
      <span className="text-[13px] text-mute leading-snug">{meta.blurb}</span>
      <span className="text-[11px] font-mono text-mute mt-auto pt-1">
        {board.primary}
        {board.subIntents.length > 0 && ` · +${board.subIntents.length} sub-intent${board.subIntents.length > 1 ? "s" : ""}`}
      </span>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent font-semibold"
          : "border-line bg-surface text-mute hover:text-ink hover:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function MiniCard({
  kind,
  run,
  domain,
  benchLabel,
}: {
  kind: "cheaper" | "over" | "upgrade";
  run: FinderCandidate;
  domain: PickDomain;
  benchLabel: string;
}) {
  const cs = costSemantics(domain);
  const head = {
    cheaper: { label: "Cheaper alternative", cls: "text-accent", icon: <TrendingUp size={12} /> },
    over: { label: "Spend more, score higher — over budget", cls: "text-warn", icon: <CircleDollarSign size={12} /> },
    upgrade: { label: "Same model, more effort", cls: "text-knee", icon: <ArrowRight size={12} /> },
  }[kind];
  return (
    <div
      className={`bg-surface border rounded-lg p-3 flex flex-col gap-1 ${
        kind === "over" ? "border-warn/60" : "border-line"
      }`}
    >
      <span className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold ${head.cls}`}>
        {head.icon}
        {head.label}
      </span>
      <span className="text-base font-bold text-ink">{run.modelDisplayName}</span>
      <span className="text-[11px] font-mono text-mute">
        {benchLabel} · {run.effortPresetSlug !== "default" ? `${run.effortPresetSlug} · ` : ""}
        {run.harnessName !== "published eval" ? `${run.harnessName} · ` : ""}
        {run.solveRate.toFixed(1)}% @{" "}
        {run.cost !== null ? `${fmtMoney(run.cost)} ${cs.unit}` : `no ${cs.unit} data`}
      </span>
      {kind === "cheaper" && run.id && domain === "coding" && (
        <Link
          to="/runs/$id"
          params={{ id: run.id }}
          className="text-xs text-knee hover:underline inline-flex items-center gap-1"
        >
          dossier <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}

function AnswerCard({
  domain,
  intent,
  run,
  benchLabel,
  why,
  budget,
  floor,
  objective,
}: {
  domain: PickDomain;
  intent: CodingIntent;
  run: FinderCandidate;
  benchLabel: string;
  why: string;
  budget: number | null;
  floor: number;
  objective: PickObjective;
}) {
  const cs = costSemantics(domain);
  const intentInfo = INTENT_BENCH[intent];
  const snapshot = domain !== "coding";
  return (
    <section
      aria-label="Pick answer"
      className="bg-surface border border-accent/50 rounded-xl p-5 shadow-sm ring-1 ring-accent/20 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-accent">
          <BadgeCheck size={13} />
          The answer
        </span>
        <span className="text-[11px] font-mono text-mute">
          {benchLabel} · floor {floor}% · {budget === null ? "budget unlimited" : `budget ${fmtMoney(budget)} ${cs.unit}`}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {snapshot ? (
          <h2 className="text-[26px] leading-tight font-bold text-ink">{run.modelDisplayName}</h2>
        ) : (
          <Link
            to="/models/$slug"
            params={{ slug: run.modelSlug }}
            className="text-[26px] leading-tight font-bold text-ink hover:text-accent hover:underline"
          >
            {run.modelDisplayName}
          </Link>
        )}
        <span className="text-[13px] font-mono text-mute">{run.modelSlug}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-ground border border-line font-mono text-mute">
          {benchLabel}
        </span>
        {run.effortPresetSlug !== "default" && (
          <span className="px-2 py-0.5 rounded bg-ground border border-line font-mono text-mute">
            effort: {run.effortPresetSlug}
          </span>
        )}
        {run.harnessName !== "published eval" && (
          <span className="px-2 py-0.5 rounded bg-ground border border-line font-mono text-mute">
            {run.harnessName}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <div className="text-3xl font-bold text-accent font-mono">{run.solveRate.toFixed(1)}%</div>
          <div className="text-[11px] text-mute">
            expected score
            {!snapshot && typeof (run as any).nTotal === "number"
              ? ` · ${(run as any).nSolved}/${(run as any).nTotal} tasks`
              : " · published eval"}
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ink font-mono">
            {run.cost !== null ? fmtMoney(run.cost) : "—"}
            <span className="text-sm font-normal text-mute"> {cs.unit}</span>
          </div>
          <div className={`text-[11px] ${cs.proxy ? "text-warn font-semibold" : "text-mute"}`}>
            {cs.label}
          </div>
        </div>
      </div>

      <p className="text-[13px] text-mute leading-snug flex items-start gap-1.5">
        <BookOpenCheck size={14} className="mt-0.5 shrink-0 text-knee" />
        {why}
      </p>

      <div className="border-t border-line pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-mute">
        <span className="font-mono">
          {run.sourceRunId} · {run.sourceName}
          <span className="ml-1 px-1 rounded border border-line">
            {(run as any).sourceOfficial === false ? "compiled" : "official"}
          </span>
        </span>
        {!snapshot && (
          <span className="flex items-center gap-3">
            <Link
              to="/runs/$id"
              params={{ id: run.id }}
              className="text-knee hover:underline inline-flex items-center gap-1"
            >
              Run dossier <ExternalLink size={10} />
            </Link>
            <Link
              to="/explore"
              search={{
                benchmark: intentInfo?.id,
                effortMatch: intentInfo?.effortMatch === "max" ? "max" : undefined,
              }}
              className="text-knee hover:underline inline-flex items-center gap-1"
            >
              Open {intentInfo?.bench ?? benchLabel} in Explorer <ExternalLink size={10} />
            </Link>
            <Link
              to="/finder"
              search={{
                benchmark: intentInfo?.id,
                maxCost: budget !== null ? String(budget) : undefined,
                objective:
                  objective === "cheapest-floor"
                    ? "cheapest-at-floor"
                    : objective === "min-resolved"
                      ? "min-cost-per-resolved"
                      : undefined,
                minSolve: objective === "cheapest-floor" ? String(floor) : undefined,
                effortMatch: intentInfo?.effortMatch === "max" ? "max" : undefined,
              }}
              className="text-knee hover:underline inline-flex items-center gap-1"
            >
              Verify in Finder <ExternalLink size={10} />
            </Link>
          </span>
        )}
      </div>
      {snapshot && (
        <p className="text-[11px] text-mute">
          Citation: see the source table linked from{" "}
          <Link to="/methodology" className="underline hover:text-ink">
            Methodology §Pick
          </Link>{" "}
          — snapshot retrieved {SNAPSHOT_RETRIEVED}, not refreshed daily.
        </p>
      )}
    </section>
  );
}

function PickPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const domain = (search.domain ?? undefined) as PickDomain | undefined;
  const intent = (search.intent ?? "agentic") as CodingIntent;
  const objective: PickObjective = search.objective ?? "best";

  const update = (patch: Record<string, unknown>) => {
    navigate({
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev, ...patch };
        for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
        return next;
      },
      replace: true,
    });
  };

  const setDomain = (d: PickDomain | undefined) => {
    update({
      domain: d,
      intent: d === "coding" ? (search.intent ?? "agentic") : undefined,
      budget: undefined,
      floor: undefined,
      objective: undefined,
    });
  };

  if (!domain) {
    return (
      <div className="flex-1 overflow-y-auto bg-ground">
        <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-ink tracking-tight">
              What are you working on? What can you spend?
            </h1>
            <p className="text-base text-mute max-w-2xl">
              Pick a domain and a budget — Pareto answers with one configuration: model, effort,
              harness, expected score, and cost, with provenance and one cheaper / one stronger
              alternative. No benchmark-version homework.
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="group" aria-label="Domains">
            {PICK_DOMAINS.map((d) => (
              <DomainCard key={d} domain={d} active={false} onSelect={(x) => setDomain(x)} />
            ))}
          </div>
          <p className="text-xs text-mute">
            Operators: the per-benchmark board lives at the{" "}
            <Link to="/explore" className="text-accent hover:underline">
              Explorer
            </Link>
            . Every answer links back to its one benchmark.
          </p>
        </div>
      </div>
    );
  }

  // ---------------- active domain ----------------
  const isCoding = domain === "coding";
  const scienceSub = domain === "science" && search.intent === "gpqa" ? "gpqa" : undefined;

  const budgetRaw = search.budget ?? "inf";
  const budget = budgetRaw === "inf" || budgetRaw === "" ? null : Number(budgetRaw);
  const floorNum = Number(search.floor);
  const floor = Number.isFinite(floorNum) && search.floor !== undefined && search.floor !== ""
    ? floorNum
    : DEFAULT_FLOOR[domain];
  const cs = costSemantics(domain);

  const slice: FinderCandidate[] = isCoding
    ? comparableCodingSlice(data.finder?.candidates ?? [], intent)
    : pickSliceCandidates(domain, scienceSub);

  const answer = pickFromCandidates(slice, { budget, floor, objective }, { hasTaskCost: isCoding });
  const benchLabel = isCoding
    ? INTENT_BENCH[intent]?.bench ?? DOMAIN_BOARD.coding.primary
    : scienceSub
      ? "GPQA Diamond (saturated)"
      : DOMAIN_BOARD[domain].primary;

  const why = (() => {
    if (!answer.best) return "";
    if (isCoding) {
      if (objective === "cheapest-floor")
        return `Cheapest ${INTENT_BENCH[intent]?.effortMatch === "max" ? "max-effort " : ""}run on ${benchLabel} that clears the ${floor}% floor under your budget. Score and cost come from the official leaderboard ingest (reported basis).`;
      if (objective === "min-resolved")
        return `Lowest cost per resolved task on the ${benchLabel} slice under your cap — total run cost ÷ resolved tasks. Read it next to the solve rate: it hides failures.`;
      return `Highest solve rate on ${benchLabel} among ${INTENT_BENCH[intent]?.effortMatch === "max" ? "max-effort (matched) " : ""}runs under ${budget === null ? "an unlimited budget" : `${fmtMoney(budget)}/task`} that clear the ${floor}% floor. Same-bench, same-effort — that is what makes it comparable.`;
    }
    const benchKey = scienceSub ? "gpqa-diamond" : DOMAIN_BOARD[domain].benchKey;
    return `Highest published ${benchKey} score among compiled rows ${budget === null ? "" : `with list price ≤ ${fmtMoney(budget)}/M output `}that clear the ${floor}% floor. Price is OpenRouter list $/M output — a proxy, not $/task.`;
  })();

  const d1Error = isCoding ? data.finder?.error : null;

  return (
    <div className="flex-1 overflow-y-auto bg-ground">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* domain switcher (compact once a domain is active) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="group" aria-label="Domains">
          {PICK_DOMAINS.map((d) => (
            <DomainCard key={d} domain={d} active={d === domain} onSelect={(x) => (x === domain ? setDomain(undefined) : setDomain(x))} />
          ))}
        </div>

        {/* honesty banner */}
        <div className={`border rounded px-3 py-2 text-xs flex flex-wrap items-center gap-2 ${isCoding ? "border-emerald-500/40 bg-emerald-950 text-emerald-300" : "border-amber-500/40 bg-amber-950 text-amber-300"}`}>
          <span className="font-bold uppercase tracking-wider text-[11px]">
            {isCoding ? "Live D1" : "Compiled snapshot"}
          </span>
          {isCoding ? (
            <span>
              Official leaderboard ingests — measured $/task, reported basis. Answer links to its
              one benchmark version.
            </span>
          ) : (
            <span>
              Compiled from public leaderboards on {SNAPSHOT_RETRIEVED} — not a daily feed. Budget
              uses OpenRouter list $/M output: <strong>a price proxy, never $/task</strong>. Rows
              without a list price are omitted, never priced at zero.
              {(domain === "math" || scienceSub === "gpqa") &&
                " Top of this board sits at the ceiling — deltas up there are noise, not signal."}
            </span>
          )}
        </div>

        {d1Error && (
          <div className="bg-red-950 border border-red-900 text-red-400 px-3 py-2 rounded text-xs">
            <strong>Database notice:</strong> {d1Error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Mobile: answer card first (order-first), controls after */}
          <div className="flex-1 flex flex-col gap-3 order-first lg:order-none">
            {answer.best ? (
              <>
                <AnswerCard
                  domain={domain}
                  intent={intent}
                  run={answer.best}
                  benchLabel={benchLabel}
                  why={why}
                  budget={budget}
                  floor={floor}
                  objective={objective}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {answer.cheaper && (
                    <MiniCard kind="cheaper" run={answer.cheaper} domain={domain} benchLabel={benchLabel} />
                  )}
                  {answer.upgrade && (
                    <MiniCard kind="upgrade" run={answer.upgrade} domain={domain} benchLabel={benchLabel} />
                  )}
                  {!answer.cheaper && !answer.upgrade && answer.strongerOverBudget === null && (
                    <div className="text-xs text-mute">
                      No cheaper alternative on this slice — the answer is already the cheapest
                      eligible configuration.
                    </div>
                  )}
                  {answer.strongerOverBudget && (
                    <MiniCard kind="over" run={answer.strongerOverBudget} domain={domain} benchLabel={benchLabel} />
                  )}
                </div>
              </>
            ) : (
              <div className="bg-surface border border-line rounded-xl p-6 flex flex-col gap-2">
                <span className="text-lg font-bold text-ink">Nothing matches — yet.</span>
                <span className="text-[13px] text-mute">
                  {slice.length} configurations on {benchLabel}: {answer.omitted.belowFloor} below
                  the {floor}% floor, {answer.omitted.noPrice} without {cs.unit} data (omitted, not
                  zeroed). Raise the budget or lower the floor.
                </span>
              </div>
            )}
            {answer.omitted.noPrice > 0 && (
              <p className="text-[11px] text-mute">
                Coverage: {answer.omitted.noPrice} row(s) omitted for missing {isCoding ? "cost telemetry" : "list price"} —
                missing data is never coerced into budget.
              </p>
            )}
          </div>

          {/* controls */}
          <aside className="w-full lg:w-80 shrink-0 bg-surface border border-line rounded-xl p-4 flex flex-col gap-5 h-fit">
            {isCoding && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-mute">
                  What kind of coding?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CODING_INTENTS.map((i) => (
                    <Chip key={i} active={i === intent} onClick={() => update({ intent: i === "agentic" ? undefined : i, budget: undefined })}>
                      {INTENT_BENCH[i].label}
                    </Chip>
                  ))}
                </div>
                <p className="text-[11px] text-mute">
                  {INTENT_BENCH[intent]?.bench} ·{" "}
                  {INTENT_BENCH[intent]?.effortMatch === "max"
                    ? "matched at max effort (xhigh shown as the spend-more step)"
                    : "all efforts shown on each answer"}
                </p>
              </div>
            )}

            {domain === "science" && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-mute">Sub-intent</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!scienceSub} onClick={() => update({ intent: undefined })}>
                    SciCode
                  </Chip>
                  <Chip
                    active={scienceSub === "gpqa"}
                    onClick={() => update({ intent: "gpqa" })}
                    title="GPQA Diamond is saturated (~95% top) — AA retired it from its Index"
                  >
                    GPQA Diamond (saturated)
                  </Chip>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-mute">
                Budget {isCoding ? "($ / task)" : "($ / M output — proxy)"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BUDGET_PRESETS[domain].map((p) => (
                  <Chip
                    key={p}
                    active={budgetRaw === p}
                    onClick={() => update({ budget: p === "inf" ? undefined : p })}
                  >
                    {p === "inf" ? "unlimited" : p === "0.5" ? "$0.50" : `$${p}`}
                  </Chip>
                ))}
              </div>
              <label className="text-[11px] text-mute" htmlFor="pick-budget">
                Custom cap
              </label>
              <input
                id="pick-budget"
                type="number"
                min="0"
                step="0.5"
                value={budgetRaw === "inf" ? "" : budgetRaw}
                placeholder="unlimited"
                onChange={(e) =>
                  update({ budget: e.target.value === "" ? undefined : e.target.value })
                }
                className="w-full bg-ground border border-line rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] uppercase tracking-wider font-bold text-mute" htmlFor="pick-floor">
                Quality floor (%)
              </label>
              <input
                id="pick-floor"
                type="number"
                min="0"
                max="100"
                step="1"
                value={search.floor ?? String(DEFAULT_FLOOR[domain])}
                onChange={(e) => update({ floor: e.target.value })}
                className="w-full bg-ground border border-line rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-mute">
                Runs below the floor are excluded, never silently accepted. Default{" "}
                {DEFAULT_FLOOR[domain]}% for {DOMAIN_META[domain].title.toLowerCase()}.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-mute">Objective</span>
              <div className="flex flex-col gap-1">
                {(
                  [
                    ["best", "Best under budget"],
                    ["cheapest-floor", "Cheapest that clears the floor"],
                    ...(isCoding ? ([["min-resolved", "Min $ / resolved task"]] as Array<[PickObjective, string]>) : []),
                  ] as Array<[PickObjective, string]>
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-ground cursor-pointer select-none text-[13px] text-ink"
                  >
                    <input
                      type="radio"
                      name="pick-objective"
                      checked={objective === value}
                      onChange={() => update({ objective: value === "best" ? undefined : value })}
                      className="accent-(--color-accent) h-3.5 w-3.5"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-mute leading-snug mt-auto">
              One ranker, stated rules: floor is a hard filter; budget eligibility and ranking are
              the Finder's deterministic rules (
              <Link to="/methodology" className="underline hover:text-ink">
                §Methodology
              </Link>
              ). Ties break on cost, then run id.
            </p>
          </aside>
        </div>

        {!isCoding && (
          <details className="bg-surface border border-line rounded px-3 py-2 text-xs text-mute">
            <summary className="cursor-pointer font-semibold text-ink">Snapshot sources &amp; licenses</summary>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              {Object.entries(COMPILED_SOURCES).map(([k, s]) => (
                <li key={k}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                    {s.name}
                  </a>{" "}
                  — retrieved {s.retrieved}. {s.license}. {s.note}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

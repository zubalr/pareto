import type { HarborRow } from "./types";
import {
  inferProvider,
  cleanModelName,
  modelToSlug,
  humanizeModelDisplayName,
} from "./aider";

export const TBENCH_URL = "https://www.tbench.ai/";
export const HARBOR_BENCHMARK_VERSION_ID = "01J8BV000000000000000TB20";
export const HARBOR_SOURCE_ID = "01J8SOURCE00000000000HARBOR";

export function parseHarborEffortSlug(rawEffort?: string): string {
  const effort = rawEffort?.toLowerCase().trim();
  if (effort === "xhigh" || effort === "extra-high" || effort === "extra_high") return "xhigh";
  if (effort === "max") return "max";
  if (effort === "high") return "high";
  if (effort === "medium" || effort === "med") return "medium";
  if (effort === "low") return "low";
  return "none";
}

function generateDeterministicId(prefix: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  const hex = (Math.abs(hash) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
  return `${prefix}${hex}${cleanSeed}`.slice(0, 26).padEnd(26, "0");
}

export interface HarborPayload {
  leaderboard?: {
    id?: string;
    package_id?: string;
    package?: string;
    name?: string;
    title?: string;
    description?: string;
  };
  rows: HarborRow[];
  nTasks: number;
  version: string;
}

export function extractHarborPayloadFromHtml(html: string): HarborPayload {
  const chunks: string[] = [];
  const regex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/gs;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse("\"" + match[1] + "\""));
    } catch {
      chunks.push(match[1]);
    }
  }
  const full = chunks.join("");

  // Extract leaderboard metadata if present
  let leaderboard: HarborPayload["leaderboard"] = undefined;
  const lbIdx = full.indexOf("\"leaderboard\":{");
  if (lbIdx !== -1) {
    const jsonStart = lbIdx + "\"leaderboard\":".length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;
    for (let i = jsonStart; i < full.length; i++) {
      const char = full[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }
    if (endIdx !== -1) {
      try {
        leaderboard = JSON.parse(full.slice(jsonStart, endIdx));
      } catch {}
    }
  }

  // Extract rows array
  const rowsIdx = full.indexOf("\"rows\":[");
  if (rowsIdx === -1) {
    return { leaderboard, rows: [], nTasks: 66, version: "4.0" };
  }
  const jsonStart = rowsIdx + "\"rows\":".length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;
  for (let i = jsonStart; i < full.length; i++) {
    const char = full[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "[" || char === "{") depth++;
      else if (char === "]" || char === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
  }
  if (endIdx === -1) return { leaderboard, rows: [], nTasks: 66, version: "4.0" };
  const rowsJson = full.slice(jsonStart, endIdx);
  const rows = JSON.parse(rowsJson) as HarborRow[];

  // Derive version: from leaderboard.title (e.g. "Terminal-Bench 4.0" -> "4.0")
  // or leaderboard.name (e.g. "4-0-0" -> "4.0"), defaulting to "4.0"
  let version = "4.0";
  if (leaderboard?.title) {
    const match = leaderboard.title.match(/Terminal-Bench\s+([0-9.]+)/i);
    if (match) version = match[1];
  } else if (leaderboard?.name) {
    version = leaderboard.name.split("-").slice(0, 2).join(".");
  }

  // Derive nTasks:
  // Each task has pass@5 trials in Terminal-Bench eval protocol
  // (e.g. n_trials = 330 with pass_at_5 reported => 330 / 5 = 66 tasks)
  let nTasks = 66;
  const sampleWithTrials = rows.find((r) => r.metrics?.n_trials);
  if (sampleWithTrials?.metrics?.n_trials) {
    const trials = sampleWithTrials.metrics.n_trials;
    const maxK =
      sampleWithTrials.metrics.pass_at_5 != null
        ? 5
        : sampleWithTrials.metrics.pass_at_4 != null
          ? 4
          : sampleWithTrials.metrics.pass_at_3 != null
            ? 3
            : sampleWithTrials.metrics.pass_at_2 != null
              ? 2
              : 1;
    nTasks = Math.round(trials / maxK) || 66;
  }

  return { leaderboard, rows, nTasks, version };
}

export function extractHarborRowsFromHtml(html: string): HarborRow[] {
  return extractHarborPayloadFromHtml(html).rows;
}

export async function fetchHarborPayload(url = TBENCH_URL): Promise<HarborPayload> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Pareto/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch from ${url}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const payload = extractHarborPayloadFromHtml(html);
  if (!payload.rows || payload.rows.length === 0) {
    throw new Error(`No rows found in tbench.ai response from ${url}`);
  }
  return payload;
}

export async function fetchHarborRows(url = TBENCH_URL): Promise<HarborRow[]> {
  const payload = await fetchHarborPayload(url);
  return payload.rows;
}

export interface IngestHarborOptions {
  d1: any;
  url?: string;
  rows?: HarborRow[];
  payload?: HarborPayload;
}

export async function ingestHarbor({
  d1,
  url,
  rows: injectedRows,
  payload: injectedPayload,
}: IngestHarborOptions): Promise<{ ingestedCount: number }> {
  const payload =
    injectedPayload ||
    (injectedRows
      ? { rows: injectedRows, nTasks: 66, version: "4.0" }
      : await fetchHarborPayload(url));
  const rows = injectedRows || payload.rows;
  const nTasks = payload.nTasks;
  const version = payload.version;

  if (!rows || rows.length === 0) {
    return { ingestedCount: 0 };
  }

  // Pre-fetch models, aliases, harnesses, harness_versions, and effort_presets
  const [modelsRes, aliasesRes, harnessesRes, hvRes, effortsRes] = await Promise.all([
    d1.prepare("SELECT id, slug, display_name FROM models").all(),
    d1.prepare("SELECT model_id, alias FROM model_aliases").all(),
    d1.prepare("SELECT id, slug, name FROM harnesses").all(),
    d1.prepare("SELECT id, harness_id, version FROM harness_versions").all(),
    d1.prepare("SELECT id, slug FROM effort_presets").all(),
  ]);

  const existingModels: Array<{ id: string; slug: string; display_name: string }> =
    modelsRes.results || [];
  const existingAliases: Array<{ model_id: string; alias: string }> =
    aliasesRes.results || [];
  const existingHarnesses: Array<{ id: string; slug: string; name: string }> =
    harnessesRes.results || [];
  const existingHv: Array<{ id: string; harness_id: string; version: string }> =
    hvRes.results || [];
  const existingEfforts: Array<{ id: string; slug: string }> =
    effortsRes.results || [];

  const modelMap = new Map<string, string>();
  for (const m of existingModels) {
    modelMap.set(m.id.toLowerCase(), m.id);
    modelMap.set(m.slug.toLowerCase(), m.id);
    modelMap.set(m.display_name.toLowerCase(), m.id);
  }
  for (const a of existingAliases) {
    modelMap.set(a.alias.toLowerCase(), a.model_id);
  }

  const harnessMap = new Map<string, string>();
  for (const h of existingHarnesses) {
    harnessMap.set(h.slug.toLowerCase(), h.id);
    harnessMap.set(h.name.toLowerCase(), h.id);
  }

  const hvMap = new Map<string, string>();
  for (const v of existingHv) {
    hvMap.set(`${v.harness_id}:${v.version.toLowerCase()}`, v.id);
  }

  const effortMap = new Map<string, string>();
  for (const e of existingEfforts) {
    effortMap.set(e.slug.toLowerCase(), e.id);
  }

  const prepStatements: any[] = [];

  function resolveOrRegisterModel(rawModelName: string): string {
    const cleaned = cleanModelName(rawModelName);
    const slug = modelToSlug(cleaned);
    const lowerCleaned = cleaned.toLowerCase();

    if (modelMap.has(lowerCleaned)) return modelMap.get(lowerCleaned)!;
    if (modelMap.has(slug)) return modelMap.get(slug)!;

    const newId = generateDeterministicId("01J8MODEL", slug);
    const { providerId } = inferProvider(cleaned);
    const humanName = humanizeModelDisplayName(cleaned);
    const now = new Date().toISOString();

    prepStatements.push(
      d1
        .prepare(
          "INSERT OR IGNORE INTO models (id, provider_id, slug, display_name, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(newId, providerId, slug, humanName, now)
    );
    prepStatements.push(
      d1
        .prepare("INSERT OR IGNORE INTO model_aliases (id, model_id, alias) VALUES (?, ?, ?)")
        .bind(generateDeterministicId("01J8ALIAS", slug), newId, slug)
    );

    modelMap.set(lowerCleaned, newId);
    modelMap.set(slug, newId);
    return newId;
  }

  function resolveOrRegisterHarness(rawHarnessName: string): string {
    const harnessName = rawHarnessName.trim() || "Harbor";
    const slug = modelToSlug(harnessName);
    const lower = harnessName.toLowerCase();

    let harnessId = harnessMap.get(lower) || harnessMap.get(slug);
    if (!harnessId) {
      harnessId = generateDeterministicId("01J8HARN", slug);
      prepStatements.push(
        d1
          .prepare("INSERT OR IGNORE INTO harnesses (id, slug, name) VALUES (?, ?, ?)")
          .bind(harnessId, slug, harnessName)
      );
      harnessMap.set(lower, harnessId);
      harnessMap.set(slug, harnessId);
    }

    const hvKey = `${harnessId}:default`;
    let hvId = hvMap.get(hvKey);
    if (!hvId) {
      hvId = generateDeterministicId("01J8HV", `${harnessId}-default`);
      prepStatements.push(
        d1
          .prepare("INSERT OR IGNORE INTO harness_versions (id, harness_id, version) VALUES (?, ?, ?)")
          .bind(hvId, harnessId, "default")
      );
      hvMap.set(hvKey, hvId);
    }

    return hvId;
  }

  // Pre-register all models and harnesses
  for (const row of rows) {
    const rawModel = row.metadata?.model_display?.label || "Unknown Model";
    const rawAgent = row.metadata?.agent_display?.label || "Unknown Agent";
    resolveOrRegisterModel(rawModel);
    resolveOrRegisterHarness(rawAgent);
  }

  // Ensure benchmark_versions row matches dynamic nTasks and version from payload
  prepStatements.push(
    d1
      .prepare("UPDATE benchmark_versions SET n_tasks = ?, version = ? WHERE id = ?")
      .bind(nTasks, version, HARBOR_BENCHMARK_VERSION_ID)
  );

  // Execute preparation statements first (batch of 50)
  for (let i = 0; i < prepStatements.length; i += 50) {
    const chunk = prepStatements.slice(i, i + 50);
    await d1.batch(chunk);
  }

  // Now construct and execute benchmark_runs statements
  const runUpsertStatements: any[] = [];

  for (const row of rows) {
    const rawModel = row.metadata?.model_display?.label || "Unknown Model";
    const rawAgent = row.metadata?.agent_display?.label || "Unknown Agent";
    const rawEffort = row.metadata?.reasoning_effort;

    const modelId = resolveOrRegisterModel(rawModel);
    const harnessVersionId = resolveOrRegisterHarness(rawAgent);
    const effortSlug = parseHarborEffortSlug(rawEffort);
    const effortPresetId = effortMap.get(effortSlug) || effortMap.get("none")!;

    const accuracy = row.metrics?.accuracy ?? 0;
    const nSolved = Math.round((accuracy / 100) * nTasks);
    const costTotal = row.metrics?.total_cost_usd ?? null;
    const costPerTask = costTotal != null ? Number((costTotal / nTasks).toFixed(4)) : null;

    const tokensIn =
      (row.metrics?.uncached_input_tokens ?? 0) + (row.metrics?.cached_input_tokens ?? 0);
    const tokensOut = row.metrics?.output_tokens ?? 0;
    const hasTokens = (row.metrics?.total_tokens ?? 0) > 0 ? 1 : 0;
    const hasCost = costTotal != null && costTotal > 0 ? 1 : 0;
    const hasLatency = row.metrics?.avg_trial_duration_sec != null ? 1 : 0;
    const hasPassAtK = row.metrics?.pass_at_2 != null ? 1 : 0;
    const hasCi = row.metrics?.accuracy_ci95_half_width != null ? 1 : 0;

    let passAtKJson = "{}";
    if (row.metrics?.pass_at_2 != null) {
      const p2 = Number(((row.metrics.pass_at_2 ?? 0) * 100).toFixed(1));
      const p3 = row.metrics.pass_at_3 != null ? Number(((row.metrics.pass_at_3 ?? 0) * 100).toFixed(1)) : undefined;
      const p4 = row.metrics.pass_at_4 != null ? Number(((row.metrics.pass_at_4 ?? 0) * 100).toFixed(1)) : undefined;
      const p5 = row.metrics.pass_at_5 != null ? Number(((row.metrics.pass_at_5 ?? 0) * 100).toFixed(1)) : undefined;
      passAtKJson = JSON.stringify({
        "2": p2,
        ...(p3 !== undefined ? { "3": p3 } : {}),
        ...(p4 !== undefined ? { "4": p4 } : {}),
        ...(p5 !== undefined ? { "5": p5 } : {}),
      });
    }

    const runId = generateDeterministicId("01J8RUNHBR", row.id);
    const createdAt = row.created_at || new Date().toISOString();

    runUpsertStatements.push(
      d1
        .prepare(
          `INSERT INTO benchmark_runs (
            id, benchmark_version_id, model_id, harness_version_id, effort_preset_id,
            source_id, source_run_id, n_solved, n_total, solve_rate,
            cost_usd_reported, cost_usd_normalized, cost_per_task_reported, cost_per_task_normalized,
            tokens_in, tokens_out, latency_p50_seconds, pass_at_k,
            has_tokens, has_cost, has_latency, has_pass_at_k, has_ci,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id, source_run_id) DO UPDATE SET
            n_solved = excluded.n_solved,
            n_total = excluded.n_total,
            solve_rate = excluded.solve_rate,
            cost_usd_reported = excluded.cost_usd_reported,
            cost_per_task_reported = excluded.cost_per_task_reported,
            tokens_in = excluded.tokens_in,
            tokens_out = excluded.tokens_out,
            latency_p50_seconds = excluded.latency_p50_seconds,
            pass_at_k = excluded.pass_at_k,
            has_tokens = excluded.has_tokens,
            has_cost = excluded.has_cost,
            has_latency = excluded.has_latency,
            has_pass_at_k = excluded.has_pass_at_k,
            has_ci = excluded.has_ci`
        )
        .bind(
          runId,
          HARBOR_BENCHMARK_VERSION_ID,
          modelId,
          harnessVersionId,
          effortPresetId,
          HARBOR_SOURCE_ID,
          row.id,
          nSolved,
          nTasks,
          accuracy,
          costTotal,
          null,
          costPerTask,
          null,
          hasTokens ? tokensIn : null,
          hasTokens ? tokensOut : null,
          row.metrics?.avg_trial_duration_sec ?? null,
          passAtKJson || "{}",
          hasTokens,
          hasCost,
          hasLatency,
          hasPassAtK,
          hasCi,
          createdAt
        )
    );
  }

  const BATCH_SIZE = 50;
  for (let i = 0; i < runUpsertStatements.length; i += BATCH_SIZE) {
    const chunk = runUpsertStatements.slice(i, i + BATCH_SIZE);
    await d1.batch(chunk);
  }

  return { ingestedCount: runUpsertStatements.length };
}

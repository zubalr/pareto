import yaml from "yaml";
import type { AiderPolyglotYamlItem } from "./types";

export const AIDER_YAML_URL =
  "https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml";

export const AIDER_BENCHMARK_VERSION_ID = "01J8BVAIDER00000000000POLY";
export const AIDER_SOURCE_ID = "01J8SOURCE000000000000AIDER";
export const AIDER_HARNESS_ID = "01J8HARNESS00000000000AIDER";
export const AIDER_DEFAULT_HV_ID = "01J8HV0000000000000AIDER10";
export const EFFORT_NONE_ID = "01J8EFFORT0000000000000NONE";
export const EFFORT_MAX_ID = "01J8EFFORT00000000000000MAX";
export const EFFORT_HIGH_ID = "01J8EFFORT0000000000000HIGH";
export const EFFORT_MED_ID = "01J8EFFORT0000000000000MED";
export const EFFORT_LOW_ID = "01J8EFFORT00000000000000LOW";

export const PROVIDER_MAP: Record<string, string> = {
  openai: "01J8PROVIDE0000000000OPENAI",
  anthropic: "01J8PROVIDE00000000ANTHROPIC",
  xai: "01J8PROVIDE00000000000000XAI",
  zhipu: "01J8PROVIDE000000000000ZHIPU",
  fable: "01J8PROVIDE000000000000FABLE",
  google: "01J8PROVIDE000000000000GOOGLE",
  deepseek: "01J8PROVIDE0000000000DEEPSEEK",
  alibaba: "01J8PROVIDE00000000000ALIBABA",
  mistral: "01J8PROVIDE00000000000MISTRAL",
  meta: "01J8PROVIDE00000000000000META",
  cohere: "01J8PROVIDE000000000000COHERE",
  moonshot: "01J8PROVIDE0000000000MOONSHOT",
  "01-ai": "01J8PROVIDE0000000000000001AI",
  other: "01J8PROVIDE0000000000000OTHER",
};

export function inferProvider(modelName: string): { providerId: string; providerSlug: string } {
  const lower = modelName.toLowerCase();
  if (lower.startsWith("claude")) return { providerId: PROVIDER_MAP.anthropic, providerSlug: "anthropic" };
  if (
    lower.startsWith("gpt") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4") ||
    lower.startsWith("chatgpt")
  ) {
    return { providerId: PROVIDER_MAP.openai, providerSlug: "openai" };
  }
  if (lower.startsWith("gemini") || lower.startsWith("gemma")) {
    return { providerId: PROVIDER_MAP.google, providerSlug: "google" };
  }
  if (lower.startsWith("grok")) return { providerId: PROVIDER_MAP.xai, providerSlug: "xai" };
  if (lower.startsWith("deepseek")) return { providerId: PROVIDER_MAP.deepseek, providerSlug: "deepseek" };
  if (lower.startsWith("qwen") || lower.startsWith("qwq")) {
    return { providerId: PROVIDER_MAP.alibaba, providerSlug: "alibaba" };
  }
  if (lower.startsWith("codestral") || lower.startsWith("mistral")) {
    return { providerId: PROVIDER_MAP.mistral, providerSlug: "mistral" };
  }
  if (lower.startsWith("command")) return { providerId: PROVIDER_MAP.cohere, providerSlug: "cohere" };
  if (lower.startsWith("llama")) return { providerId: PROVIDER_MAP.meta, providerSlug: "meta" };
  if (lower.startsWith("kimi")) return { providerId: PROVIDER_MAP.moonshot, providerSlug: "moonshot" };
  if (lower.startsWith("yi-")) return { providerId: PROVIDER_MAP["01-ai"], providerSlug: "01-ai" };
  return { providerId: PROVIDER_MAP.other, providerSlug: "other" };
}

export function parseEffort(item: AiderPolyglotYamlItem): { effortPresetId: string; effortSlug: string } {
  let effort = item.reasoning_effort?.toLowerCase().trim();
  if (!effort) {
    const match = item.model.match(/\((high|medium|low|max)\)/i);
    if (match) {
      effort = match[1].toLowerCase();
    }
  }

  if (effort === "high") return { effortPresetId: EFFORT_HIGH_ID, effortSlug: "high" };
  if (effort === "medium" || effort === "med") return { effortPresetId: EFFORT_MED_ID, effortSlug: "medium" };
  if (effort === "low") return { effortPresetId: EFFORT_LOW_ID, effortSlug: "low" };
  if (effort === "max") return { effortPresetId: EFFORT_MAX_ID, effortSlug: "max" };
  return { effortPresetId: EFFORT_NONE_ID, effortSlug: "none" };
}

export function cleanModelName(rawModel: string): string {
  // Strip trailing (high), (medium), (low), (max)
  return rawModel.replace(/\s*\((high|medium|low|max)\)\s*$/i, "").trim();
}

export function modelToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export async function fetchAiderPolyglotData(url = AIDER_YAML_URL): Promise<AiderPolyglotYamlItem[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Aider polyglot YAML from ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed = yaml.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid Aider YAML format: expected an array of leaderboard entries");
  }
  return parsed as AiderPolyglotYamlItem[];
}

export interface IngestAiderOptions {
  d1: any; // Cloudflare D1 database binding
  yamlUrl?: string;
  items?: AiderPolyglotYamlItem[];
}

export async function ingestAiderPolyglot(options: IngestAiderOptions): Promise<{ runsIngested: number }> {
  const { d1 } = options;
  const items = options.items ?? (await fetchAiderPolyglotData(options.yamlUrl));

  // 1. Fetch existing models, harnesses, and aliases to avoid duplicate inserts
  const [modelsRes, harnessVerRes] = await Promise.all([
    d1.prepare("SELECT id, slug, display_name FROM models").all(),
    d1.prepare("SELECT id, harness_id, version FROM harness_versions WHERE harness_id = ?").bind(AIDER_HARNESS_ID).all(),
  ]);

  const modelMapBySlug = new Map<string, string>();
  for (const m of (modelsRes.results || []) as Array<{ id: string; slug: string }>) {
    modelMapBySlug.set(m.slug, m.id);
  }

  const harnessVerMap = new Map<string, string>();
  for (const hv of (harnessVerRes.results || []) as Array<{ id: string; version: string }>) {
    harnessVerMap.set(hv.version, hv.id);
  }

  const prepStatements: any[] = [];

  // 2. Prepare models and harness versions
  for (const item of items) {
    const rawModel = item.model?.trim();
    if (!rawModel) continue;

    const cleaned = cleanModelName(rawModel);
    const slug = modelToSlug(cleaned);

    let modelId = modelMapBySlug.get(slug);
    if (!modelId) {
      modelId = generateDeterministicId("01J8MOD", slug);
      modelMapBySlug.set(slug, modelId);
      const { providerId } = inferProvider(cleaned);

      prepStatements.push(
        d1
          .prepare(
            `INSERT OR IGNORE INTO models (id, provider_id, slug, display_name, created_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(modelId, providerId, slug, cleaned, "2026-09-05T00:00:00Z")
      );

      // Add alias for exact raw string
      prepStatements.push(
        d1
          .prepare(`INSERT OR IGNORE INTO model_aliases (id, model_id, alias) VALUES (?, ?, ?)`)
          .bind(generateDeterministicId("01J8AL", `${modelId}:${rawModel}`), modelId, rawModel)
      );
      // Add alias for cleaned slug
      prepStatements.push(
        d1
          .prepare(`INSERT OR IGNORE INTO model_aliases (id, model_id, alias) VALUES (?, ?, ?)`)
          .bind(generateDeterministicId("01J8AL", `${modelId}:${slug}`), modelId, slug)
      );
    }

    const version = item.versions?.trim() || "default";
    let hvId = harnessVerMap.get(version);
    if (!hvId) {
      hvId = version === "default" ? AIDER_DEFAULT_HV_ID : generateDeterministicId("01J8HV", `aider:${version}`);
      harnessVerMap.set(version, hvId);
      prepStatements.push(
        d1
          .prepare(`INSERT OR IGNORE INTO harness_versions (id, harness_id, version) VALUES (?, ?, ?)`)
          .bind(hvId, AIDER_HARNESS_ID, version)
      );
    }
  }

  // Execute dimension setups in batch if any
  if (prepStatements.length > 0) {
    // Chunk statements in groups of 50 to respect D1 batch limits
    for (let i = 0; i < prepStatements.length; i += 50) {
      const chunk = prepStatements.slice(i, i + 50);
      await d1.batch(chunk);
    }
  }

  // 3. Prepare benchmark_runs upserts
  const runStatements: any[] = [];
  let runsCount = 0;

  for (const item of items) {
    if (!item.dirname || !item.model) continue;

    const cleaned = cleanModelName(item.model);
    const slug = modelToSlug(cleaned);
    const modelId = modelMapBySlug.get(slug);
    if (!modelId) continue;

    const version = item.versions?.trim() || "default";
    const harnessVersionId = harnessVerMap.get(version) || AIDER_DEFAULT_HV_ID;
    const { effortPresetId } = parseEffort(item);

    const nTotal = item.test_cases || 225;
    const solveRate = Number(item.pass_rate_2 ?? 0);
    const nSolved = item.pass_num_2 ?? Math.round((solveRate / 100) * nTotal);

    const costUsdReported =
      item.total_cost != null && item.total_cost !== "" && !isNaN(Number(item.total_cost))
        ? Number(item.total_cost)
        : null;

    const costPerTaskReported = costUsdReported !== null ? costUsdReported / nTotal : null;

    const hasCost = costUsdReported !== null ? 1 : 0;
    const hasPassAtK = item.pass_rate_1 != null && item.pass_rate_2 != null ? 1 : 0;
    const passAtK = hasPassAtK
      ? JSON.stringify({
          "1": Number(item.pass_rate_1),
          "2": Number(item.pass_rate_2),
        })
      : "{}";

    const hasTokens = 0;
    const hasLatency = 0;
    const hasCi = 0;

    const runId = generateDeterministicId("01J8RAID", item.dirname);
    const createdAt = item.date ? `${item.date}T00:00:00Z` : new Date().toISOString();

    runStatements.push(
      d1
        .prepare(
          `INSERT INTO benchmark_runs (
            id, benchmark_version_id, model_id, harness_version_id, effort_preset_id,
            source_id, source_run_id, n_solved, n_total, solve_rate,
            cost_usd_reported, cost_usd_normalized, cost_per_task_reported, cost_per_task_normalized,
            has_tokens, has_cost, has_latency, has_pass_at_k, has_ci,
            pass_at_k, latency_p50_seconds, tokens_in, tokens_out, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, NULL, ?, NULL,
            ?, ?, ?, ?, ?,
            ?, NULL, ?, ?, ?
          )
          ON CONFLICT(source_id, source_run_id) DO UPDATE SET
            model_id = excluded.model_id,
            harness_version_id = excluded.harness_version_id,
            effort_preset_id = excluded.effort_preset_id,
            n_solved = excluded.n_solved,
            n_total = excluded.n_total,
            solve_rate = excluded.solve_rate,
            cost_usd_reported = excluded.cost_usd_reported,
            cost_per_task_reported = excluded.cost_per_task_reported,
            has_tokens = excluded.has_tokens,
            has_cost = excluded.has_cost,
            has_latency = excluded.has_latency,
            has_pass_at_k = excluded.has_pass_at_k,
            has_ci = excluded.has_ci,
            pass_at_k = excluded.pass_at_k,
            tokens_in = excluded.tokens_in,
            tokens_out = excluded.tokens_out,
            created_at = excluded.created_at`
        )
        .bind(
          runId,
          AIDER_BENCHMARK_VERSION_ID,
          modelId,
          harnessVersionId,
          effortPresetId,
          AIDER_SOURCE_ID,
          item.dirname,
          nSolved,
          nTotal,
          solveRate,
          costUsdReported,
          costPerTaskReported,
          hasTokens,
          hasCost,
          hasLatency,
          hasPassAtK,
          hasCi,
          passAtK || "{}",
          item.prompt_tokens ?? null,
          item.completion_tokens ?? null,
          createdAt
        )
    );

    runsCount++;
  }

  // Execute runs in chunks of 50
  for (let i = 0; i < runStatements.length; i += 50) {
    const chunk = runStatements.slice(i, i + 50);
    await d1.batch(chunk);
  }

  return { runsIngested: runsCount };
}

import type { OpenRouterApiResponse, OpenRouterModelItem } from "./types";

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

function generateDeterministicId(prefix: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  const hex = (Math.abs(hash) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
  return `${prefix}${hex}${cleanSeed}`.slice(0, 26).padEnd(26, "0");
}

export async function fetchOpenRouterModels(url = OPENROUTER_MODELS_URL): Promise<OpenRouterModelItem[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenRouter models from ${url}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as OpenRouterApiResponse;
  if (!json || !Array.isArray(json.data)) {
    throw new Error("Invalid OpenRouter API response: expected data array");
  }
  return json.data;
}

export const OPENROUTER_MODEL_ALIASES: Record<string, string[]> = {
  "anthropic/claude-sonnet-4": [
    "claude-sonnet-4-20250514-no-thinking",
    "claude-sonnet-4-20250514-32k-thinking",
    "claude-sonnet-4",
  ],
  "anthropic/claude-opus-4": [
    "claude-opus-4-20250514-no-think",
    "claude-opus-4-20250514-32k-thinking",
    "claude-opus-4",
  ],
  "anthropic/claude-fable-5": ["fable-5", "claude-fable-5"],
  "anthropic/claude-fable-5.1": ["fable-5-1", "claude-fable-5-1"],
  "anthropic/claude-sonnet-4.6": ["claude-sonnet-4-6"],
  "anthropic/claude-opus-4.8": ["claude-opus-4-8"],
  "anthropic/claude-opus-5": ["claude-opus-5"],
  "anthropic/claude-sonnet-5": ["claude-sonnet-5"],
  "google/gemini-2.5-flash": [
    "gemini-2-5-flash-preview-05-20-no-think",
    "gemini-2-5-flash-preview-05-20-24k-think",
    "gemini-2.5-flash",
  ],
  "google/gemini-2.5-pro": [
    "gemini-2-5-pro-preview-06-05-default-think",
    "gemini-2-5-pro-preview-06-05-32k-think",
    "gemini-2.5-pro",
  ],
  "google/gemini-3.1-pro-preview": ["gemini-3-1-pro-preview"],
  "google/gemini-3.5-flash": ["gemini-3-5-flash"],
  "google/gemini-3.6-flash": ["gemini-3-6-flash"],
  "google/gemini-3.7-flash": ["gemini-3-7-flash"],
  "google/gemini-3.8-flash": ["gemini-3-8-flash"],
  "deepseek/deepseek-v3.2-exp": [
    "deepseek-v3-2-exp-chat",
    "deepseek-v3-2-exp-reasoner",
  ],
  "deepseek/deepseek-v4-flash": ["deepseek-v4-flash"],
  "deepseek/deepseek-v4-pro": ["deepseek-v4-pro"],
  "openai/gpt-4.1": ["o3-high-gpt-4-1", "gpt-4-1"],
  "openai/gpt-5.4": ["gpt-5-4"],
  "openai/gpt-5.5": ["gpt-5-5"],
  "openai/gpt-5.6-luna": ["gpt-5-6-luna"],
  "openai/gpt-5.6-sol": ["gpt-5-6-sol"],
  "openai/gpt-5.6-terra": ["gpt-5-6-terra"],
  "openai/gpt-6-astra": ["gpt-6-astra"],
  "x-ai/grok-4.5": ["grok-4", "grok-4-5"],
  "x-ai/grok-4.6": ["grok-4-6"],
  "qwen/qwen3.8-max": ["qwen3-8-max"],
};

export interface IngestOpenRouterOptions {
  d1: any;
  modelsUrl?: string;
  models?: OpenRouterModelItem[];
  snapshotDate?: string; // YYYY-MM-DD
}

export async function ingestOpenRouterPricing(
  options: IngestOpenRouterOptions
): Promise<{ snapshotsIngested: number; matchedModels: string[] }> {
  const { d1 } = options;
  const orModels = options.models ?? (await fetchOpenRouterModels(options.modelsUrl));

  // Determine snapshot date (UTC YYYY-MM-DD)
  const snapshotDate = options.snapshotDate ?? new Date().toISOString().slice(0, 10);

  // Fetch all existing models and aliases from D1
  const [modelsRes, aliasesRes] = await Promise.all([
    d1.prepare("SELECT id, slug, display_name FROM models").all(),
    d1.prepare("SELECT model_id, alias FROM model_aliases").all(),
  ]);

  const slugToModelId = new Map<string, string>();
  const displayNameToModelId = new Map<string, string>();
  for (const m of (modelsRes.results || []) as Array<{ id: string; slug: string; display_name: string }>) {
    slugToModelId.set(m.slug.toLowerCase(), m.id);
    displayNameToModelId.set(m.display_name.toLowerCase(), m.id);
  }

  const aliasToModelId = new Map<string, string>();
  for (const a of (aliasesRes.results || []) as Array<{ model_id: string; alias: string }>) {
    aliasToModelId.set(a.alias.toLowerCase(), a.model_id);
  }

  // Pre-seed known OpenRouter aliases into aliasToModelId and D1 if model exists
  const extraAliasStatements: any[] = [];
  for (const [orId, targetSlugs] of Object.entries(OPENROUTER_MODEL_ALIASES)) {
    for (const targetSlug of targetSlugs) {
      const modelId = slugToModelId.get(targetSlug.toLowerCase());
      if (modelId) {
        const fullLower = orId.toLowerCase();
        const bareLower = fullLower.replace(/^[^/]+\//, "");
        aliasToModelId.set(fullLower, modelId);
        aliasToModelId.set(bareLower, modelId);

        extraAliasStatements.push(
          d1
            .prepare("INSERT OR IGNORE INTO model_aliases (id, model_id, alias) VALUES (?, ?, ?)")
            .bind(generateDeterministicId("01J8AL", `${modelId}:${orId}`), modelId, orId)
        );
      }
    }
  }

  if (extraAliasStatements.length > 0) {
    for (let i = 0; i < extraAliasStatements.length; i += 50) {
      const chunk = extraAliasStatements.slice(i, i + 50);
      try {
        await d1.batch(chunk);
      } catch (e) {
        console.warn("[OpenRouter] Non-critical error inserting model_aliases:", e);
      }
    }
  }

  const matchedSnapshots = new Map<
    string,
    {
      id: string;
      modelId: string;
      modelSlug: string;
      snapshotDate: string;
      promptPer1m: number;
      completionPer1m: number;
    }
  >();

  for (const orModel of orModels) {
    if (!orModel.id || !orModel.pricing) continue;

    const rawPrompt = orModel.pricing.prompt;
    const rawCompletion = orModel.pricing.completion;
    if (rawPrompt == null || rawCompletion == null) continue;

    const promptNum = Number(rawPrompt);
    const completionNum = Number(rawCompletion);
    if (isNaN(promptNum) || isNaN(completionNum)) continue;

    const promptPer1m = promptNum * 1_000_000;
    const completionPer1m = completionNum * 1_000_000;

    const fullId = orModel.id.toLowerCase();
    const bareId = fullId.replace(/^[^/]+\//, "");
    const nameLower = orModel.name?.toLowerCase();

    // Match priority: exact alias -> bare alias -> exact slug -> bare slug -> display name
    const modelId =
      aliasToModelId.get(fullId) ||
      aliasToModelId.get(bareId) ||
      slugToModelId.get(bareId) ||
      slugToModelId.get(fullId) ||
      (nameLower ? displayNameToModelId.get(nameLower) : undefined);

    if (modelId) {
      // Don't overwrite if standard non-batch variant already matched
      if (!matchedSnapshots.has(modelId) || !fullId.includes(":batch")) {
        matchedSnapshots.set(modelId, {
          id: generateDeterministicId("01J8PS", `${modelId}:${snapshotDate}`),
          modelId,
          modelSlug: bareId,
          snapshotDate,
          promptPer1m,
          completionPer1m,
        });
      }
    }
  }

  const snapshotStatements: any[] = [];
  const matchedList: string[] = [];

  for (const [modelId, snap] of matchedSnapshots.entries()) {
    matchedList.push(snap.modelSlug);
    snapshotStatements.push(
      d1
        .prepare(
          `INSERT OR REPLACE INTO pricing_snapshots (id, model_id, snapshot_date, prompt_per_1m, completion_per_1m)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(snap.id, snap.modelId, snap.snapshotDate, snap.promptPer1m, snap.completionPer1m)
    );
  }

  // Execute in batches of 50
  for (let i = 0; i < snapshotStatements.length; i += 50) {
    const chunk = snapshotStatements.slice(i, i + 50);
    await d1.batch(chunk);
  }

  return {
    snapshotsIngested: snapshotStatements.length,
    matchedModels: matchedList,
  };
}

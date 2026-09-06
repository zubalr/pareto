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

import { describe, it, expect } from "vitest";
import { cleanModelName, parseEffort, inferProvider, modelToSlug } from "../src/ingest/aider";
import { extractHarborRowsFromHtml, parseHarborEffortSlug } from "../src/ingest/harbor";
import { parseSWEBenchSystem } from "../src/ingest/swebench";
import yaml from "yaml";

describe("Aider Ingest Transforms", () => {
  it("cleans model names and strips trailing reasoning effort indicators", () => {
    expect(cleanModelName("gpt-5 (high)")).toBe("gpt-5");
    expect(cleanModelName("o1-2024-12-17 (high)")).toBe("o1-2024-12-17");
    expect(cleanModelName("o3-mini (medium)")).toBe("o3-mini");
    expect(cleanModelName("Grok 3 Mini Beta (low)")).toBe("Grok 3 Mini Beta");
    expect(cleanModelName("claude-3-5-sonnet-20241022")).toBe("claude-3-5-sonnet-20241022");
  });

  it("extracts effort correctly from explicit field or embedded model string", () => {
    expect(parseEffort({ dirname: "test", model: "gpt-5", reasoning_effort: "high" }).effortSlug).toBe("high");
    expect(parseEffort({ dirname: "test", model: "o1-2024-12-17 (high)" }).effortSlug).toBe("high");
    expect(parseEffort({ dirname: "test", model: "o3-mini (medium)" }).effortSlug).toBe("medium");
    expect(parseEffort({ dirname: "test", model: "grok (low)" }).effortSlug).toBe("low");
    expect(parseEffort({ dirname: "test", model: "claude-3-5-sonnet-20241022" }).effortSlug).toBe("none");
  });

  it("infers providers accurately from model names", () => {
    expect(inferProvider("claude-3-5-sonnet-20241022").providerSlug).toBe("anthropic");
    expect(inferProvider("gpt-4o-mini-2024-07-18").providerSlug).toBe("openai");
    expect(inferProvider("o1-2024-12-17").providerSlug).toBe("openai");
    expect(inferProvider("Gemini 2.0 Pro exp-02-05").providerSlug).toBe("google");
    expect(inferProvider("grok-4").providerSlug).toBe("xai");
    expect(inferProvider("DeepSeek R1").providerSlug).toBe("deepseek");
    expect(inferProvider("Qwen2.5-Coder-32B-Instruct").providerSlug).toBe("alibaba");
    expect(inferProvider("Codestral 25.01").providerSlug).toBe("mistral");
    expect(inferProvider("command-a-03-2025-quality").providerSlug).toBe("cohere");
    expect(inferProvider("Llama 4 Maverick").providerSlug).toBe("meta");
  });

  it("converts model names to valid URL and database slugs", () => {
    expect(modelToSlug("Gemini 2.0 Pro exp-02-05")).toBe("gemini-2-0-pro-exp-02-05");
    expect(modelToSlug("claude-3-5-sonnet-20241022")).toBe("claude-3-5-sonnet-20241022");
    expect(modelToSlug("Qwen2.5-Coder-32B-Instruct")).toBe("qwen2-5-coder-32b-instruct");
  });

  it("parses YAML leaderboard structure correctly", () => {
    const sampleYaml = `
- dirname: 2025-02-25-20-23-07--gemini-pro
  test_cases: 225
  model: Gemini 2.0 Pro exp-02-05
  pass_rate_1: 20.4
  pass_rate_2: 35.6
  total_cost: 0.0000
    `;
    const parsed = yaml.parse(sampleYaml);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].dirname).toBe("2025-02-25-20-23-07--gemini-pro");
    expect(parsed[0].test_cases).toBe(225);
    expect(parsed[0].pass_rate_2).toBe(35.6);
  });
});

describe("Harbor / Terminal-Bench Ingest Transforms", () => {
  it("extracts effort correctly for harbor submissions", () => {
    expect(parseHarborEffortSlug("xhigh")).toBe("xhigh");
    expect(parseHarborEffortSlug("max")).toBe("max");
    expect(parseHarborEffortSlug("high")).toBe("high");
    expect(parseHarborEffortSlug("medium")).toBe("medium");
    expect(parseHarborEffortSlug("low")).toBe("low");
    expect(parseHarborEffortSlug(undefined)).toBe("none");
  });

  it("extracts rows from Next.js RSC flight payload in HTML", () => {
    const mockHtml = `
      <!DOCTYPE html><html><body>
      <script>self.__next_f.push([1,"1:{\\"rows\\":[{\\"id\\":\\"test-row-1\\",\\"metadata\\":{\\"model_display\\":{\\"label\\":\\"GPT-6 Astra\\"},\\"agent_display\\":{\\"label\\":\\"Codex\\"},\\"reasoning_effort\\":\\"max\\"},\\"metrics\\":{\\"accuracy\\":58.18,\\"total_cost_usd\\":3267.18,\\"pass_at_2\\":0.6485,\\"total_tokens\\":1529778322,\\"avg_trial_duration_sec\\":2796.3,\\"accuracy_ci95_half_width\\":2.79}}]}"])</script>
      </body></html>
    `;
    const rows = extractHarborRowsFromHtml(mockHtml);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("test-row-1");
    expect(rows[0].metadata?.model_display?.label).toBe("GPT-6 Astra");
    expect(rows[0].metrics?.accuracy).toBe(58.18);
    expect(rows[0].metrics?.total_cost_usd).toBe(3267.18);
    expect(rows[0].metrics?.pass_at_2).toBe(0.6485);
  });
});

describe("SWE-bench Ingest Transforms", () => {
  it("parses model, harness, and effort from SWE-bench entry tags and name", () => {
    const item1 = {
      name: "Sonar Foundation Agent + Claude 4.5 Opus",
      folder: "20251205_sonar-foundation-agent_claude-opus-4-5",
      resolved: 79.2,
      tags: ["Model: claude-opus-4-5", "Org: Sonar"],
    };
    const parsed1 = parseSWEBenchSystem(item1);
    expect(parsed1.modelName).toBe("claude-opus-4-5");
    expect(parsed1.harnessName).toBe("Sonar Foundation Agent");
    expect(parsed1.effortSlug).toBe("none");

    const item2 = {
      name: "SWE-agent + GPT-4o (high)",
      folder: "20241010_swe-agent_gpt-4o",
      resolved: 42.0,
      reasoning_effort: "high",
    };
    const parsed2 = parseSWEBenchSystem(item2);
    expect(parsed2.modelName).toBe("GPT-4o");
    expect(parsed2.harnessName).toBe("SWE-agent");
  });
});


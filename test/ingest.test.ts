import { describe, it, expect } from "vitest";
import { cleanModelName, parseEffort, inferProvider, modelToSlug } from "../src/ingest/aider";
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

import { describe, it, expect } from "vitest";
import {
  parseDeepSWEEffort,
  transformDeepSWERow,
  DEEPSWE_TASKS,
} from "../src/ingest/deepswe";
import type { DeepSWERow } from "../src/ingest/types";

describe("DeepSWE Ingest Transforms", () => {
  it("normalizes reasoning effort strings correctly", () => {
    expect(parseDeepSWEEffort("xhigh")).toBe("xhigh");
    expect(parseDeepSWEEffort("extra-high")).toBe("xhigh");
    expect(parseDeepSWEEffort("high")).toBe("high");
    expect(parseDeepSWEEffort("medium")).toBe("medium");
    expect(parseDeepSWEEffort("med")).toBe("medium");
    expect(parseDeepSWEEffort("low")).toBe("low");
    expect(parseDeepSWEEffort("max")).toBe("max");
    expect(parseDeepSWEEffort("none")).toBe("none");
    expect(parseDeepSWEEffort("default")).toBe("none");
    expect(parseDeepSWEEffort(null)).toBe("none");
    expect(parseDeepSWEEffort(undefined)).toBe("none");
  });

  it("transforms a complete DeepSWE live leaderboard row accurately", () => {
    const sampleRow: DeepSWERow = {
      model: "gpt-6-astra",
      harness: "mini-swe-agent",
      provider: "openai",
      reasoning_effort: "xhigh",
      config: "mini_swe_agent_gpt_6_astra_xhigh",
      source: "deep-swe",
      pass_rate: 0.7411504424778761,
      pass_at_1: 0.7411504424778761,
      pass_at_4: 0.8053097345132744,
      n_passed: 335,
      n_attempted: 452,
      n_tasks_attempted: 113,
      n_tasks_passed_any: 91,
      ci_lo: 0.7124964807371247,
      ci_hi: 0.7698044042186275,
      ci_half: 0.02865396174075141,
      mean_cost_usd: 6.52377356460177,
      median_cost_usd: 5.6717151,
      mean_input_tokens: 1456927.0929203539,
      mean_output_tokens: 29557.327433628318,
      mean_duration_seconds: 1132.4004424778761,
      median_duration_seconds: 959.0,
    };

    const transformed = transformDeepSWERow(sampleRow, 113);

    expect(transformed.sourceRunId).toBe("mini_swe_agent_gpt_6_astra_xhigh");
    expect(transformed.rawModel).toBe("gpt-6-astra");
    expect(transformed.rawHarness).toBe("mini-swe-agent");
    expect(transformed.effortSlug).toBe("xhigh");
    expect(transformed.nTotal).toBe(113);

    // 0.74115044 * 113 = 83.75 -> 84 solved
    expect(transformed.nSolved).toBe(84);
    expect(transformed.solveRate).toBe(74.1);

    // Cost mapping
    expect(transformed.costPerTaskReported).toBe(6.5238);
    // 6.5237735646 * 113 = 737.1864
    expect(transformed.costUsdReported).toBe(737.1864);

    // Token mapping (mean * 113)
    // 1456927.0929203539 * 113 = 164632761.5 -> 164632762
    expect(transformed.tokensIn).toBe(164632762);
    // 29557.327433628318 * 113 = 3339978
    expect(transformed.tokensOut).toBe(3339978);

    // Latency takes median if available
    expect(transformed.latencyP50Seconds).toBe(959.0);

    // Pass@k JSON
    const parsedPass = JSON.parse(transformed.passAtKJson);
    expect(parsedPass["1"]).toBe(74.1);
    expect(parsedPass["4"]).toBe(80.5);

    // Coverage flags
    expect(transformed.hasCost).toBe(1);
    expect(transformed.hasTokens).toBe(1);
    expect(transformed.hasLatency).toBe(1);
    expect(transformed.hasPassAtK).toBe(1);
    expect(transformed.hasCi).toBe(1);
  });

  it("handles missing cost and telemetry cleanly with 0 coverage flags", () => {
    const minimalRow: DeepSWERow = {
      model: "claude-opus-5",
      harness: "mini-swe-agent",
      config: "mini_swe_agent_claude_opus_5_none",
      pass_rate: 0.5,
      pass_at_1: 0.5,
    };

    const transformed = transformDeepSWERow(minimalRow, DEEPSWE_TASKS);

    expect(transformed.nSolved).toBe(57); // round(0.5 * 113) = 57
    expect(transformed.solveRate).toBe(50.0);
    expect(transformed.costPerTaskReported).toBeNull();
    expect(transformed.costUsdReported).toBeNull();
    expect(transformed.tokensIn).toBeNull();
    expect(transformed.tokensOut).toBeNull();
    expect(transformed.latencyP50Seconds).toBeNull();
    expect(transformed.passAtKJson).toBe(JSON.stringify({ "1": 50.0 }));

    expect(transformed.hasCost).toBe(0);
    expect(transformed.hasTokens).toBe(0);
    expect(transformed.hasLatency).toBe(0);
    expect(transformed.hasPassAtK).toBe(0);
    expect(transformed.hasCi).toBe(0);
  });

  it("never returns empty passAtK as null or undefined", () => {
    const emptyRow: DeepSWERow = {
      model: "test-model",
      harness: "test-harness",
      config: "test_config",
    };

    const transformed = transformDeepSWERow(emptyRow);
    expect(transformed.passAtKJson).toBe("{}");
  });
});

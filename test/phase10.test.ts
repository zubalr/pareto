import { describe, it, expect } from "vitest";
import { buildRunsCsv, CSV_HEADER, parseDensity, relativeTime, CsvRun } from "../src/theme";
import { relativeTime as relFromHealth } from "../src/ingestHealth";

const row: CsvRun = {
  model: 'GPT-6 "Astra"',
  harness: "mini-SWE-agent",
  effort: "max",
  solveRate: 74.1,
  costPerTaskReported: 6.52,
  costPerTaskNormalized: 16.05,
  hasTokens: true,
  hasCost: true,
  hasLatency: false,
  hasPassAtK: true,
  hasCi: false,
  sourceRunId: "mini_swe_agent_gpt_6_astra_xhigh",
};

describe("buildRunsCsv", () => {
  it("emits the required header row first", () => {
    const csv = buildRunsCsv([row]);
    expect(csv.split("\n")[0]).toBe(CSV_HEADER.join(","));
    expect(CSV_HEADER).toContain("usd_per_task_reported");
    expect(CSV_HEADER).toContain("usd_per_task_today");
    expect(CSV_HEADER).toContain("source_run_id");
  });

  it("renders coverage flags and blanks for missing prices", () => {
    const csv = buildRunsCsv([{ ...row, costPerTaskNormalized: null }]);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("yes,yes,no,yes,no");
    expect(lines[1].endsWith("mini_swe_agent_gpt_6_astra_xhigh")).toBe(true);
    expect(lines[1].split(",")[5]).toBe(""); // missing today price stays empty, not 0
  });

  it("quotes fields containing commas or quotes", () => {
    const csv = buildRunsCsv([row]);
    expect(csv).toContain('"GPT-6 ""Astra"""');
  });

  it("never includes task text columns", () => {
    const csv = buildRunsCsv([row]);
    expect(csv.toLowerCase()).not.toContain("prompt");
    expect(csv.toLowerCase()).not.toContain("statement");
  });
});

describe("parseDensity", () => {
  it("accepts comfortable and defaults to compact", () => {
    expect(parseDensity("comfortable")).toBe("comfortable");
    expect(parseDensity("compact")).toBe("compact");
    expect(parseDensity(undefined)).toBe("compact");
    expect(parseDensity("bogus")).toBe("compact");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-07T12:00:00Z");
  it("formats seconds, minutes, hours, days", () => {
    expect(relFromHealth("2026-09-07T11:59:30Z", now)).toBe("30s ago");
    expect(relFromHealth("2026-09-07T11:46:00Z", now)).toBe("14m ago");
    expect(relFromHealth("2026-09-07T09:00:00Z", now)).toBe("3h ago");
    expect(relFromHealth("2026-09-05T12:00:00Z", now)).toBe("2d ago");
  });
  it("returns empty for unparseable timestamps", () => {
    expect(relFromHealth("nope", now)).toBe("");
  });
});

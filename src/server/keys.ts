export function buildCanonicalExplorerKey(input: {
  benchmarkVersionId?: string;
  models?: string[];
  harnesses?: string[];
  efforts?: string[];
  costBasis?: "reported" | "today";
}): string {
  let benchId = (input.benchmarkVersionId || "").trim();
  if (!benchId || benchId === "terminal-bench" || benchId === "terminal-bench-4.0") {
    benchId = "01J8BV0000000000000000TB40";
  } else if (benchId === "swe-bench-verified" || benchId === "swe-bench-verified-1.0") {
    benchId = "01J8BV000000000000000SWE10";
  } else if (benchId === "aider-polyglot" || benchId === "aider-polyglot-1.0") {
    benchId = "01J8BVAIDER00000000000POLY";
  }

  const cost = input.costBasis === "today" ? "today" : "reported";
  const m = Array.from(new Set((input.models ?? []).filter(Boolean))).sort().join(",");
  const h = Array.from(new Set((input.harnesses ?? []).filter(Boolean))).sort().join(",");
  const e = Array.from(new Set((input.efforts ?? []).filter(Boolean))).sort().join(",");

  return `explorer:${benchId}:cb=${cost}:m=${m}:h=${h}:e=${e}`;
}

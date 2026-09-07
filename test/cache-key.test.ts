import { describe, it, expect } from "vitest";
import { buildCanonicalExplorerKey } from "../src/server/keys";

describe("Canonical Explorer Key Generation", () => {
  it("normalizes empty or undefined params to the default DeepSWE 1.1 slice", () => {
    const key1 = buildCanonicalExplorerKey({});
    const key2 = buildCanonicalExplorerKey({
      benchmarkVersionId: undefined,
      models: [],
      harnesses: [],
      efforts: [],
      costBasis: "reported",
    });

    expect(key1).toBe("explorer:01J8BV000000000000DEEPSWE11:cb=reported:m=:h=:e=:em=all");
    expect(key2).toBe(key1);
  });

  it("normalizes explicit terminal-bench params to TB 4.0 slice", () => {
    const key3 = buildCanonicalExplorerKey({
      benchmarkVersionId: "terminal-bench",
      costBasis: "reported",
    });
    const key4 = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV0000000000000000TB40",
      costBasis: "reported",
    });

    expect(key3).toBe("explorer:01J8BV0000000000000000TB40:cb=reported:m=:h=:e=:em=all");
    expect(key4).toBe(key3);
  });

  it("produces deterministic keys regardless of array ordering", () => {
    const keyOrderA = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV0000000000000000TB40",
      models: ["glm-5-3", "claude-opus-5", "gpt-5-6-sol"],
      harnesses: ["grok-build", "codex"],
      efforts: ["max", "high"],
      costBasis: "today",
    });

    const keyOrderB = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV0000000000000000TB40",
      models: ["gpt-5-6-sol", "glm-5-3", "claude-opus-5"],
      harnesses: ["codex", "grok-build"],
      efforts: ["high", "max"],
      costBasis: "today",
    });

    expect(keyOrderA).toBe(
      "explorer:01J8BV0000000000000000TB40:cb=today:m=claude-opus-5,glm-5-3,gpt-5-6-sol:h=codex,grok-build:e=high,max:em=all"
    );
    expect(keyOrderA).toBe(keyOrderB);
  });

  it("deduplicates array elements and handles empty strings", () => {
    const key = buildCanonicalExplorerKey({
      models: ["glm-5-3", "", "glm-5-3", "claude-opus-5"],
    });

    expect(key).toBe("explorer:01J8BV000000000000DEEPSWE11:cb=reported:m=claude-opus-5,glm-5-3:h=:e=:em=all");
  });

  it("preserves xhigh effort preset distinctly in canonical key", () => {
    const key = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV000000000000DEEPSWE11",
      models: ["gpt-6-astra"],
      efforts: ["xhigh"],
      costBasis: "reported",
    });
    expect(key).toBe("explorer:01J8BV000000000000DEEPSWE11:cb=reported:m=gpt-6-astra:h=:e=xhigh:em=all");
  });

  it("handles alternative benchmark IDs properly", () => {
    const key = buildCanonicalExplorerKey({
      benchmarkVersionId: "swe-bench-verified",
      models: ["claude-opus-5"],
    });

    expect(key).toBe("explorer:01J8BV000000000000000SWE10:cb=reported:m=claude-opus-5:h=:e=:em=all");
  });

  it("handles aider-polyglot benchmark IDs and slugs properly", () => {
    const keySlug = buildCanonicalExplorerKey({
      benchmarkVersionId: "aider-polyglot",
      costBasis: "reported",
    });
    const keyVersion = buildCanonicalExplorerKey({
      benchmarkVersionId: "aider-polyglot-1.0",
      costBasis: "reported",
    });
    const keyId = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BVAIDER00000000000POLY",
      costBasis: "reported",
    });

    expect(keySlug).toBe("explorer:01J8BVAIDER00000000000POLY:cb=reported:m=:h=:e=:em=all");
    expect(keyVersion).toBe(keySlug);
    expect(keyId).toBe(keySlug);
  });

  it("handles terminal-bench-2 benchmark IDs and slugs properly", () => {
    const keySlug = buildCanonicalExplorerKey({
      benchmarkVersionId: "terminal-bench-2",
      costBasis: "reported",
    });
    const keyVersion = buildCanonicalExplorerKey({
      benchmarkVersionId: "terminal-bench-2-2.0",
      costBasis: "reported",
    });
    const keyId = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV000000000000000TB20",
      costBasis: "reported",
    });

    expect(keySlug).toBe("explorer:01J8BV000000000000000TB20:cb=reported:m=:h=:e=:em=all");
    expect(keyVersion).toBe(keySlug);
    expect(keyId).toBe(keySlug);
  });

  it("handles deepswe benchmark IDs and slugs properly", () => {
    const keySlug = buildCanonicalExplorerKey({
      benchmarkVersionId: "deepswe",
      costBasis: "today",
    });
    const keyVersion = buildCanonicalExplorerKey({
      benchmarkVersionId: "deepswe-1.1",
      costBasis: "today",
    });
    const keyId = buildCanonicalExplorerKey({
      benchmarkVersionId: "01J8BV000000000000DEEPSWE11",
      costBasis: "today",
    });

    expect(keySlug).toBe("explorer:01J8BV000000000000DEEPSWE11:cb=today:m=:h=:e=:em=all");
    expect(keyVersion).toBe(keySlug);
    expect(keyId).toBe(keySlug);
  });
});

describe("effortMatch in the canonical key", () => {
  it("max and xhigh produce distinct keys, distinct from all", () => {
    const all = buildCanonicalExplorerKey({ effortMatch: "all" });
    const max = buildCanonicalExplorerKey({ effortMatch: "max" });
    const xhigh = buildCanonicalExplorerKey({ effortMatch: "xhigh" });
    expect(max).not.toBe(all);
    expect(xhigh).not.toBe(all);
    expect(max).not.toBe(xhigh);
    expect(max).toContain(":em=max");
  });
});

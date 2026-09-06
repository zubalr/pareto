import { describe, it, expect } from "vitest";
import { parseHealthPayload } from "../src/ingestHealth";

describe("parseHealthPayload", () => {
  it("parses the status convention", () => {
    const h = parseHealthPayload({ status: "ok", last_job: "success" });
    expect(h?.state).toBe("ok");
    expect(h?.statusLabel).toBe("last job: success");
    expect(h?.errored).toBe(false);
  });

  it("flags errored jobs and carries the error text", () => {
    const h = parseHealthPayload({ status: "error", error: "D1 write failed" });
    expect(h?.state).toBe("error");
    expect(h?.errored).toBe(true);
    expect(h?.detail).toBe("D1 write failed");
  });

  it("parses the ok-boolean convention", () => {
    expect(parseHealthPayload({ ok: true })?.state).toBe("ok");
    expect(parseHealthPayload({ ok: false })?.errored).toBe(true);
  });

  it("takes the latest job from a jobs array", () => {
    const h = parseHealthPayload({ jobs: [{ status: "ok" }, { status: "failed" }] });
    expect(h?.errored).toBe(true);
    expect(h?.statusLabel).toBe("last job: failed");
  });

  it("returns unknown-state for unrecognized JSON shapes", () => {
    const h = parseHealthPayload({ hello: "world" });
    expect(h?.state).toBe("unknown");
    expect(h?.statusLabel).toContain("unrecognized");
  });

  it("rejects null, arrays, and non-objects", () => {
    expect(parseHealthPayload(null)).toBeNull();
    expect(parseHealthPayload([1, 2])).toBeNull();
    expect(parseHealthPayload("ok")).toBeNull();
  });
});

describe("parseHealthPayload cost counts", () => {
  it("surfaces reported/restated/total cost counts when present", () => {
    const h = parseHealthPayload({
      status: "ok",
      reportedCostCount: 100,
      restatedCostCount: 20,
      totalRuns: 281,
    });
    expect(h?.counts).toEqual({ reported: 100, restated: 20, total: 281 });
  });
  it("omits counts when the endpoint does not expose them", () => {
    expect(parseHealthPayload({ status: "ok" })?.counts).toBeUndefined();
  });
});

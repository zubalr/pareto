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

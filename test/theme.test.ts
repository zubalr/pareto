import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveTheme, getThemePref, resolveTheme } from "../src/theme";

// Minimal window/document/localStorage/matchMedia stubs for the theme module.
function stubWindow(prefersDark = true) {
  const store = new Map<string, string>();
  const listeners: Array<() => void> = [];
  const windowStub = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    matchMedia: (q: string) => ({
      matches: q.includes("light") ? !prefersDark : prefersDark,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      },
    }),
    dispatchEvent: () => true,
    document: {
      documentElement: { classList: { toggle: () => {} }, style: {} },
      body: {},
    },
  };
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("document", windowStub.document);
  vi.stubGlobal("CustomEvent", class {});
  return { store, listeners };
}

describe("theme preference round-trip", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saveTheme persists and getThemePref reads it back", () => {
    stubWindow(true);
    saveTheme("light");
    expect(getThemePref()).toBe("light");
    saveTheme("system");
    expect(getThemePref()).toBe("system");
    saveTheme("dark");
    expect(getThemePref()).toBe("dark");
  });

  it("defaults to dark with no stored preference", () => {
    stubWindow(true);
    expect(getThemePref()).toBe("dark");
  });

  it("resolves system to the OS preference", () => {
    stubWindow(false);
    expect(resolveTheme("system")).toBe("light");
    stubWindow(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });
});

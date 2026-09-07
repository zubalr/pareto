// Theme preference + palette helpers — defensive for SSR/unit tests.
// Preference lives in localStorage ("pareto-theme") and can be forced per view
// with the ?theme= search param (the boot script in __root applies it pre-paint
// and persists it).

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

import * as React from "react";

const KEY = "pareto-theme";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getThemePref(): ThemePref {
  if (!hasWindow()) return "dark";
  const stored = window.localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

export function systemPrefersDark(): boolean {
  if (!hasWindow() || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(pref: ThemePref = getThemePref()): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

/** Applies the resolved theme to <html> (class + color-scheme). */
export function applyTheme(pref: ThemePref = getThemePref()): ResolvedTheme {
  const resolved = resolveTheme(pref);
  if (!hasWindow()) return resolved;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  return resolved;
}

export function saveTheme(pref: ThemePref): ResolvedTheme {
  if (hasWindow()) window.localStorage.setItem(KEY, pref);
  const resolved = applyTheme(pref);
  if (hasWindow()) window.dispatchEvent(new CustomEvent("pareto-theme-change"));
  return resolved;
}

/** Subscribes to theme changes (toggle clicks, system switches while on "system"). */
export function subscribeTheme(cb: () => void): () => void {
  if (!hasWindow()) return () => {};
  const onChange = () => cb();
  window.addEventListener("pareto-theme-change", onChange);
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("pareto-theme-change", onChange);
    mq?.removeEventListener?.("change", onChange);
  };
}

export function prefersReducedMotion(): boolean {
  if (!hasWindow() || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface ChartPalette {
  dark: boolean;
  dominated: string;
  frontier: string;
  frontierBorder: string;
  knee: string;
  pin: string;
  grid: string;
  axis: string;
  label: string;
  axisName: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  category: string[];
}

const DARK_PALETTE: ChartPalette = {
  dark: true,
  dominated: "#52525b",
  frontier: "#10b981",
  frontierBorder: "#064e3b",
  knee: "#06b6d4",
  pin: "#f59e0b",
  grid: "#18181b",
  axis: "#27272a",
  label: "#a1a1aa",
  axisName: "#a1a1aa",
  tooltipBg: "#101013",
  tooltipBorder: "#3f3f46",
  tooltipText: "#f4f4f5",
  category: ["#10b981", "#06b6d4", "#a78bfa", "#f59e0b", "#f472b6", "#60a5fa"],
};

const LIGHT_PALETTE: ChartPalette = {
  dark: false,
  dominated: "#a1a1aa",
  frontier: "#059669",
  frontierBorder: "#065f46",
  knee: "#0891b2",
  pin: "#d97706",
  grid: "#e4e4e7",
  axis: "#d4d4d8",
  label: "#52525b",
  axisName: "#3f3f46",
  tooltipBg: "#ffffff",
  tooltipBorder: "#d4d4d8",
  tooltipText: "#18181b",
  category: ["#047857", "#0e7490", "#7c3aed", "#b45309", "#be185d", "#1d4ed8"],
};

/** Chart palette for the currently resolved theme (read at chart init). */
export function chartPalette(): ChartPalette {
  if (!hasWindow()) return DARK_PALETTE;
  return resolveTheme() === "light" ? LIGHT_PALETTE : DARK_PALETTE;
}

/** Categorical hues per theme (chart slots + colorBy legend). */
export function categoryPalette(): string[] {
  if (!hasWindow()) return DARK_PALETTE.category;
  return chartPalette().category;
}

/** Re-renders the caller when the resolved theme changes (toggle or OS switch). */
export function useThemeTick(): number {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => subscribeTheme(() => setTick((v) => v + 1)), []);
  return tick;
}

/** CSV builder for the visible table slice. Aggregates only — never task text. */
export interface CsvRun {
  model: string;
  harness: string;
  effort: string;
  solveRate: number;
  costPerTaskReported: number | null;
  costPerTaskNormalized: number | null;
  hasTokens: boolean;
  hasCost: boolean;
  hasLatency: boolean;
  hasPassAtK: boolean;
  hasCi: boolean;
  sourceRunId: string;
  benchmarkName?: string;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const CSV_HEADER = [
  "model",
  "harness",
  "effort",
  "solve_rate_pct",
  "usd_per_task_reported",
  "usd_per_task_today",
  "coverage_tokens",
  "coverage_cost",
  "coverage_latency",
  "coverage_pass_at_k",
  "coverage_ci",
  "source_run_id",
] as const;

export function buildRunsCsv(rows: CsvRun[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    const cells = [
      csvEscape(r.model),
      csvEscape(r.harness),
      csvEscape(r.effort),
      r.solveRate.toFixed(1),
      r.costPerTaskReported !== null && r.costPerTaskReported !== undefined
        ? r.costPerTaskReported.toFixed(2)
        : "",
      r.costPerTaskNormalized !== null && r.costPerTaskNormalized !== undefined
        ? r.costPerTaskNormalized.toFixed(2)
        : "",
      r.hasTokens ? "yes" : "no",
      r.hasCost ? "yes" : "no",
      r.hasLatency ? "yes" : "no",
      r.hasPassAtK ? "yes" : "no",
      r.hasCi ? "yes" : "no",
      csvEscape(r.sourceRunId),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

/** Parses a density search-param value defensively. */
export function parseDensity(v: unknown): "compact" | "comfortable" {
  return v === "comfortable" ? "comfortable" : "compact";
}

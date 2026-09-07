import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getThemePref,
  saveTheme,
  subscribeTheme,
  type ThemePref,
} from "../theme";

const OPTIONS: Array<{ value: ThemePref; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun size={11} /> },
  { value: "dark", label: "Dark", icon: <Moon size={11} /> },
  { value: "system", label: "System", icon: <Monitor size={11} /> },
];

export function ThemeToggle() {
  const [pref, setPref] = React.useState<ThemePref>(() => getThemePref());

  React.useEffect(() => subscribeTheme(() => setPref(getThemePref())), []);

  const change = (value: ThemePref) => {
    setPref(value);
    saveTheme(value);
  };

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="grid grid-cols-3 p-0.5 rounded border border-zinc-700/80 bg-zinc-900"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => change(o.value)}
          aria-pressed={pref === o.value}
          title={`${o.label} theme`}
          className={`px-1.5 py-0.5 rounded inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            pref === o.value
              ? "bg-zinc-800 text-emerald-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.icon}
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

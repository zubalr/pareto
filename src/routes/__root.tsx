/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import * as React from "react";
import "@fontsource-variable/source-sans-3";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import appCss from "../styles/app.css?url";
import { DEFAULT_THEME_PREF } from "../theme";
import { ThemeToggle } from "../components/ThemeToggle";

const NAV = [
  { to: "/", label: "Pick", exact: true },
  { to: "/explore", label: "Explorer" },
  { to: "/finder", label: "Finder" },
  { to: "/compare", label: "Compare" },
  { to: "/methodology", label: "Methodology" },
] as const;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pareto Pick | the right model for your budget" },
      {
        name: "description",
        content:
          "Pick your domain and budget, get one model × effort answer with expected score, cost, and provenance. Pareto frontier analysis of public LLM benchmark runs.",
      },
      { property: "og:title", content: "Pareto — benchmark cost vs solve intelligence" },
      {
        property: "og:description",
        content:
          "Who is on the Pareto frontier, where is the knee, what does it cost? Aggregates from DeepSWE, Terminal-Bench, Aider, and SWE-bench runs with full provenance and honest coverage flags.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://pareto.jubairjashim1975.workers.dev" },
      { property: "og:image", content: "https://pareto.jubairjashim1975.workers.dev/og.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Pareto — benchmark cost vs solve intelligence" },
      {
        name: "twitter:description",
        content:
          "Pick, frontier, knee detection, and a deterministic budget Finder across DeepSWE, Harbor TB2, Aider polyglot, and SWE-bench Verified slices.",
      },
      { name: "twitter:image", content: "https://pareto.jubairjashim1975.workers.dev/og.png" },
    ],
    scripts: [
      {
        // Pre-paint theme: ?theme= wins, then the stored preference, then the
        // light product default. Kept in lockstep with theme.ts (DEFAULT_THEME_PREF).
        children: `(function(){try{var u=new URLSearchParams(location.search).get('theme');var k='pareto-theme';var dflt='${DEFAULT_THEME_PREF}';var p=u||localStorage.getItem(k)||dflt;if(u)localStorage.setItem(k,p);var d=p==='system'?!window.matchMedia('(prefers-color-scheme: light)').matches:p!=='light';var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%23F7F5F0'/%3E%3Cpolyline points='14,78 38,58 58,50 86,22' fill='none' stroke='%230F9F6E' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='58' cy='50' r='13' fill='%231D4ED8' stroke='%23FFFEFB' stroke-width='4'/%3E%3C/svg%3E",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    // Light is the product default: SSR paints the paper world, the boot
    // script flips to dark pre-paint only for stored dark/system-dark prefs.
    <html lang="en" className="light h-full bg-ground text-ink">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full flex flex-col font-sans text-sm antialiased bg-ground text-ink">
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="border-b border-line bg-surface/90 sticky top-0 z-40 px-4 py-2 flex items-center justify-between backdrop-blur">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-ink hover:text-accent group shrink-0">
              <span className="h-5 w-5 bg-accent/15 text-accent border border-accent/40 rounded flex items-center justify-center font-bold text-xs">
                P
              </span>
              <span className="font-bold tracking-wide text-sm">Pareto</span>
            </Link>

            <nav className="flex items-center gap-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={item.exact ? { exact: true } : undefined}
                  activeProps={{ className: "bg-accent/10 text-accent font-semibold" }}
                  inactiveProps={{ className: "text-mute hover:text-ink hover:bg-ground" }}
                  className="px-2.5 py-1 rounded transition-colors text-[13px] shrink-0 whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-mute text-[11px]">
            <ThemeToggle />
            <span className="hidden sm:inline-block">Cloudflare Workers + D1</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" title="Connected" />
          </div>
        </header>

        <main id="main" className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>

        <footer className="border-t border-line bg-surface/60 px-4 py-2 text-xs text-mute flex flex-wrap items-center justify-between gap-2">
          <div>
            Pareto — a visualization &amp; recommendation layer over public evals. Not an official
            leaderboard, not an index.
          </div>
          <div>
            <Link to="/methodology" className="text-mute hover:text-ink hover:underline">
              Method &amp; provenance
            </Link>
          </div>
        </footer>

        <Scripts />
      </body>
    </html>
  );
}

/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import * as React from "react";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pareto Frontier | LLM Benchmark Cost vs Solve Intelligence" },
      {
        name: "description",
        content:
          "Pareto Frontier analysis of LLM benchmark solve rates against USD cost per task. Find optimal models and efficiency knees.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" }
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="dark h-full bg-[#09090b] text-[#f4f4f5]">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full flex flex-col font-mono text-xs antialiased bg-[#09090b] text-[#f4f4f5]">
        <header className="border-b border-zinc-800/80 bg-zinc-950/80 sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between backdrop-blur">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-zinc-100 hover:text-white group">
              <span className="h-5 w-5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded flex items-center justify-center font-bold text-xs">
                P
              </span>
              <span className="font-bold tracking-wider text-sm">PARETO</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-sans border border-zinc-700">
                PHASE 1
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-zinc-800 text-emerald-400 font-semibold" }}
                inactiveProps={{ className: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900" }}
                className="px-2.5 py-1 rounded transition-colors text-xs"
              >
                Explorer
              </Link>
              <Link
                to="/methodology"
                activeProps={{ className: "bg-zinc-800 text-emerald-400 font-semibold" }}
                inactiveProps={{ className: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900" }}
                className="px-2.5 py-1 rounded transition-colors text-xs"
              >
                Methodology
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
            <span className="hidden sm:inline-block">Host: Cloudflare Workers + D1</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Connected" />
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </main>

        <footer className="border-t border-zinc-800/60 bg-zinc-950/40 px-4 py-2 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
          <div>
            Pareto Intelligence &bull; Compiled from public leaderboard fixtures &bull; Illustrative eval runs
          </div>
          <div>
            <Link to="/methodology" className="text-zinc-400 hover:underline">Canary &amp; Formulas</Link>
          </div>
        </footer>

        <Scripts />
      </body>
    </html>
  );
}

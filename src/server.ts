import handler from "@tanstack/react-start/server-entry";
import { runIngestPipeline } from "./ingest";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ingest" || url.pathname === "/__scheduled") {
      try {
        const result = await runIngestPipeline({ env, ctx });
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err?.message || String(err) }, null, 2),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    return handler.fetch(request, env, ctx);
  },

  async scheduled(event: any, env: any, ctx: any) {
    console.log(`[Scheduled] Ingest cron triggered: ${event.cron} at ${new Date().toISOString()}`);
    ctx.waitUntil(runIngestPipeline({ env, ctx }));
  },
};

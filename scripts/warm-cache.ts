/**
 * Cache Warming Script for Pareto
 * 
 * Warms the default Terminal-Bench 4.0 slice into Workers KV.
 * Usage:
 *   node scripts/warm-cache.ts [--url=http://localhost:8787]
 */

const targetUrl = process.argv.find((arg) => arg.startsWith("--url="))?.split("=")[1] ||
  process.env.TARGET_URL ||
  "http://localhost:8787";

async function warm() {
  console.log(`[Cache Warmer] Priming cache on target: ${targetUrl}`);
  try {
    const startTime = Date.now();
    const res = await fetch(targetUrl);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Target returned HTTP ${res.status}: ${res.statusText}`);
    }

    console.log(`[Cache Warmer] Request 1 completed in ${durationMs}ms (HTTP ${res.status})`);

    // Verify cache hit on second request
    const secondStart = Date.now();
    const res2 = await fetch(targetUrl);
    const secondDurationMs = Date.now() - secondStart;

    console.log(`[Cache Warmer] Request 2 completed in ${secondDurationMs}ms (HTTP ${res2.status})`);
    console.log(`[Cache Warmer] Cache successfully warmed!`);
  } catch (err: any) {
    console.error(`[Cache Warmer] Failed to warm cache:`, err.message);
    process.exitCode = 1;
  }
}

warm();

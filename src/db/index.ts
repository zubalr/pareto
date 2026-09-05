import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export function getDb() {
  try {
    if (!env || !env.DB) {
      throw new Error("Cloudflare D1 binding DB is not available");
    }
    return drizzle(env.DB, { schema });
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
}

export function getKv() {
  try {
    return env?.FRONTIER ?? null;
  } catch {
    return null;
  }
}

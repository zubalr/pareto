import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

let globalEnv: any = null;

export function setGlobalEnv(e: any) {
  if (e) globalEnv = e;
}

export function getDb(d1Instance?: any) {
  try {
    const rawDb = d1Instance || globalEnv?.DB || env?.DB;
    if (!rawDb) {
      throw new Error("Cloudflare D1 binding DB is not available");
    }
    return drizzle(rawDb, { schema });
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
}

export function getKv(kvInstance?: any) {
  try {
    return kvInstance || globalEnv?.FRONTIER || env?.FRONTIER || null;
  } catch {
    return null;
  }
}

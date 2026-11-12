import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getServerEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

/*
 * Neon's HTTP driver sends each query as a stateless HTTPS request: no
 * connection pool to exhaust when many serverless functions run at once,
 * which is the usual Postgres-on-Vercel pitfall. (It doesn't support
 * interactive transactions; this app doesn't need them.)
 *
 * The database is optional at build time: without DATABASE_URL, getDb()
 * returns null and history features report "not configured" instead of crashing.
 */
function createDb(url: string) {
  return drizzle({ client: neon(url), schema });
}

export type Db = ReturnType<typeof createDb>;

let db: Db | null | undefined;

export function getDb(): Db | null {
  if (db === undefined) {
    const url = getServerEnv().env.DATABASE_URL;
    db = url ? createDb(url) : null;
  }
  return db;
}

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env.local by itself; load it the same way Next does.
loadEnvConfig(process.cwd());

/*
 * `npm run db:generate` diffs lib/db/schema.ts against previous migrations and
 * writes a new SQL file to drizzle/ (committed, reviewable).
 * `npm run db:migrate` applies pending migrations to DATABASE_URL.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});

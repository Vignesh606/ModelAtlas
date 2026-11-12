import "server-only";
import { z } from "zod";

/*
 * Server environment, validated with zod. Secrets live only in env vars
 * (.env.local locally, project settings on Vercel) and never reach the client:
 * this module is server-only and nothing here is prefixed NEXT_PUBLIC_.
 *
 * Variables are optional at build time so CI can build without secrets;
 * features that need one check for it at request time and return a clear error.
 */
const envSchema = z.object({
  OPENROUTER_API_KEY: z
    .string()
    .trim()
    .regex(/^sk-or-/, "OPENROUTER_API_KEY should start with sk-or-")
    .optional(),
  /** Optional override for the playground's default model id. */
  OPENROUTER_DEFAULT_MODEL: z.string().trim().min(3).optional(),
  /** Postgres connection string (Neon). Without it, request history is disabled. */
  DATABASE_URL: z
    .string()
    .trim()
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL should be a postgres:// or postgresql:// URL")
    .optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

/** Empty strings count as "not set" (common when a var is declared but left blank). */
function readRawEnv(): Record<string, string | undefined> {
  const pick = (name: string) => process.env[name]?.trim() || undefined;
  return {
    OPENROUTER_API_KEY: pick("OPENROUTER_API_KEY"),
    OPENROUTER_DEFAULT_MODEL: pick("OPENROUTER_DEFAULT_MODEL"),
    DATABASE_URL: pick("DATABASE_URL"),
  };
}

let cached: { env: ServerEnv; problems: string[] } | null = null;

/** Parses once per server instance. Invalid values are dropped and reported, never thrown. */
export function getServerEnv(): { env: ServerEnv; problems: string[] } {
  if (cached) return cached;
  const raw = readRawEnv();
  const result = envSchema.safeParse(raw);
  if (result.success) {
    cached = { env: result.data, problems: [] };
  } else {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    // Keep the valid fields, drop the invalid ones.
    const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    const partial = Object.fromEntries(Object.entries(raw).filter(([key]) => !invalid.has(key)));
    cached = { env: envSchema.parse(partial), problems };
  }
  return cached;
}

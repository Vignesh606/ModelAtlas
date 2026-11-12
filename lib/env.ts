import "server-only";
import { z } from "zod";
import { isValidKey, type ProviderId } from "@/lib/providers";

/*
 * Server environment, validated with zod. Secrets live only in env vars
 * (.env.local locally, project settings on Vercel) and never reach the client:
 * this module is server-only and nothing here is prefixed NEXT_PUBLIC_.
 *
 * Variables are optional at build time so CI can build without secrets;
 * features that need one check for it at request time and return a clear error.
 *
 * Google Gemini is the primary/default provider. Other providers (including
 * OpenRouter) are optional and activated by adding their API key.
 */
const envSchema = z.object({
  /** Primary API key: Google Gemini (AI Studio). */
  GEMINI_API_KEY: z.string().trim().min(10, "GEMINI_API_KEY looks too short").optional(),
  /** Optional override for the playground's default model id. */
  GEMINI_DEFAULT_MODEL: z.string().trim().min(3).optional(),

  /** Optional OpenRouter key. With it, OpenRouter models load automatically. */
  OPENROUTER_API_KEY: z
    .string()
    .trim()
    .regex(/^sk-or-/, "OPENROUTER_API_KEY should start with sk-or-")
    .optional(),
  /** Optional override for the playground's default OpenRouter model id. */
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
    GEMINI_API_KEY: pick("GEMINI_API_KEY") ?? pick("GOOGLE_API_KEY") ?? pick("google_ai_studio_api") ?? pick("GOOGLE_AI_STUDIO_API"),
    GEMINI_DEFAULT_MODEL: pick("GEMINI_DEFAULT_MODEL"),
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

/**
 * Server-side key for a provider, if the deployment has one.
 * Gemini reads from the validated GEMINI_API_KEY env (already resolved from
 * GEMINI_API_KEY / GOOGLE_API_KEY / google_ai_studio_api). OpenRouter reads
 * OPENROUTER_API_KEY. Others read <PROVIDER>_API_KEY.
 * Malformed keys count as missing.
 */
export function serverKeyFor(provider: ProviderId): string | undefined {
  if (provider === "gemini") return getServerEnv().env.GEMINI_API_KEY;
  if (provider === "openrouter") return getServerEnv().env.OPENROUTER_API_KEY;
  const names = [`${provider.toUpperCase()}_API_KEY`];
  for (const name of names) {
    const key = process.env[name]?.trim();
    if (key && isValidKey(provider, key)) return key;
  }
  return undefined;
}

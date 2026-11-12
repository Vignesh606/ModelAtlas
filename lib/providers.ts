/*
 * Chat providers. All of them speak the OpenAI-compatible /chat/completions
 * API, so one code path serves every provider. OpenRouter is the catalog
 * source; for the others the user brings a key and we list their /models.
 */

export const PROVIDER_IDS = [
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "deepseek",
  "mistral",
  "xai",
  "together",
  "fireworks",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface Provider {
  name: string;
  baseUrl: string;
  keyHint: string;
  /** Ask for usage in the final stream chunk (OpenAI-style `stream_options`). */
  streamUsage?: boolean;
  /** Name of the max-tokens field (OpenAI's newer models only accept max_completion_tokens). */
  maxTokensField?: string;
  /** Preferred default model when the server has a key for this provider. */
  defaultModel?: string;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyHint: "sk-or-..." },
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", keyHint: "sk-...", streamUsage: true, maxTokensField: "max_completion_tokens" },
  anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", keyHint: "sk-ant-...", streamUsage: true },
  gemini: { name: "Google", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyHint: "AIza...", streamUsage: true, defaultModel: "gemini-2.5-flash" },
  groq: { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", keyHint: "gsk_...", streamUsage: true },
  deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyHint: "sk-...", streamUsage: true },
  mistral: { name: "Mistral", baseUrl: "https://api.mistral.ai/v1", keyHint: "API key" },
  xai: { name: "xAI", baseUrl: "https://api.x.ai/v1", keyHint: "xai-...", streamUsage: true },
  together: { name: "Together AI", baseUrl: "https://api.together.xyz/v1", keyHint: "API key" },
  fireworks: { name: "Fireworks", baseUrl: "https://api.fireworks.ai/inference/v1", keyHint: "fw_..." },
};

/** Auth headers. Anthropic's /models needs its own headers; Bearer covers the rest. */
export function authHeaders(provider: ProviderId, key: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  }
  return headers;
}

/** Keys are header values: no spaces or odd characters. OpenRouter keys are checked strictly. */
export function isValidKey(provider: ProviderId, key: string): boolean {
  return provider === "openrouter" ? /^sk-or-[A-Za-z0-9_-]{10,200}$/.test(key) : /^[A-Za-z0-9._-]{16,400}$/.test(key);
}

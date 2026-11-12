"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ChatSettings } from "@/components/playground/use-chat";
import { Button } from "@/components/ui/button";
import { CHAT_LIMITS, USER_KEY_HEADER, apiErrorBodySchema } from "@/lib/chat";
import { formatContext, formatPrice } from "@/lib/format";
import type { ChatModel } from "@/lib/playground";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/lib/providers";
import { modelHref } from "@/lib/routes";

/**
 * Model info, request parameters and the optional bring-your-own-key fields.
 * Parameters only appear if at least one active model supports them; each
 * request then only includes what its own model accepts.
 */
export function SettingsPanel({
  models,
  settings,
  onSettingsChange,
  keys,
  onKeyChange,
  onModelsLoaded,
  serverHasKey,
  serverProviders,
}: {
  models: ChatModel[];
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
  keys: Partial<Record<ProviderId, string>>;
  onKeyChange: (provider: ProviderId, key: string) => void;
  onModelsLoaded: (provider: ProviderId, models: ChatModel[]) => void;
  serverHasKey: boolean;
  serverProviders: ProviderId[];
}) {
  const id = useId();
  const supportsTemperature = models.some((m) => m.supportedParameters.includes("temperature"));
  const supportsMaxTokens = models.some((m) => m.supportedParameters.includes("max_tokens"));
  const set = (patch: Partial<ChatSettings>) => onSettingsChange({ ...settings, ...patch });

  return (
    <div className="space-y-4">
      <Card title={models.length > 1 ? "Models" : "Model"}>
        <ul className="space-y-3">
          {models.map((m) => (
            <li key={m.id} className="text-sm">
              {m.provider === "openrouter" ? (
                <Link href={modelHref(m.id)} className="font-medium hover:underline">
                  {m.name}
                </Link>
              ) : (
                <span className="font-medium">{m.name}</span>
              )}
              <dl className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Context</dt>
                  <dd className="font-mono tabular-nums">{formatContext(m.context)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Input/1M</dt>
                  <dd className="font-mono tabular-nums">{formatPrice(m.pricing.input)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Output/1M</dt>
                  <dd className="font-mono tabular-nums">{formatPrice(m.pricing.output)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Parameters">
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-system`} className="text-sm font-medium">
              System prompt
            </label>
            <textarea
              id={`${id}-system`}
              value={settings.system}
              onChange={(e) => set({ system: e.target.value })}
              maxLength={CHAT_LIMITS.maxSystemChars}
              rows={3}
              placeholder="e.g. You are a concise assistant."
              className="mt-1.5 block w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm placeholder:text-muted hover:border-border-strong"
            />
          </div>

          {supportsTemperature ? (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`${id}-temp`} className="text-sm font-medium">
                  Temperature
                </label>
                <span className="font-mono text-xs tabular-nums">
                  {settings.temperature === null ? "default" : settings.temperature.toFixed(1)}
                </span>
              </div>
              <input
                id={`${id}-temp`}
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature ?? 1}
                onChange={(e) => set({ temperature: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--fg)]"
              />
              {settings.temperature !== null ? (
                <button type="button" onClick={() => set({ temperature: null })} className="text-xs text-muted underline underline-offset-2 hover:text-fg">
                  Use model default
                </button>
              ) : null}
            </div>
          ) : null}

          {supportsMaxTokens ? (
            <div>
              <label htmlFor={`${id}-max`} className="text-sm font-medium">
                Max output tokens
              </label>
              <input
                id={`${id}-max`}
                type="number"
                min={1}
                max={CHAT_LIMITS.maxOutputTokens}
                step={1}
                inputMode="numeric"
                value={settings.maxTokens ?? ""}
                placeholder="Model default"
                onChange={(e) => {
                  const value = e.target.value === "" ? null : Math.round(Number(e.target.value));
                  if (value === null || (Number.isFinite(value) && value >= 1)) {
                    set({ maxTokens: value === null ? null : Math.min(value, CHAT_LIMITS.maxOutputTokens) });
                  }
                }}
                className="mt-1.5 h-9 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm tabular-nums placeholder:font-sans placeholder:text-muted hover:border-border-strong"
              />
            </div>
          ) : null}

          {!supportsTemperature && !supportsMaxTokens ? (
            <p className="text-xs text-muted">This model doesn&apos;t accept temperature or max-token settings.</p>
          ) : (
            <p className="text-xs text-muted">Only parameters the selected model supports are shown.</p>
          )}
        </div>
      </Card>

      <ProviderKeys keys={keys} onKeyChange={onKeyChange} onModelsLoaded={onModelsLoaded} serverHasKey={serverHasKey} serverProviders={serverProviders} />
    </div>
  );
}

/**
 * Pick a provider, paste its key, and (for non-OpenRouter providers) load the
 * models that key can use. Loaded models appear in the model switcher.
 */
function ProviderKeys({
  keys,
  onKeyChange,
  onModelsLoaded,
  serverHasKey,
  serverProviders,
}: {
  keys: Partial<Record<ProviderId, string>>;
  onKeyChange: (provider: ProviderId, key: string) => void;
  onModelsLoaded: (provider: ProviderId, models: ChatModel[]) => void;
  serverHasKey: boolean;
  serverProviders: ProviderId[];
}) {
  const id = useId();
  const [provider, setProvider] = useState<ProviderId>("openrouter");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<{ loading: boolean; message: string }>({ loading: false, message: "" });
  const { name, keyHint } = PROVIDERS[provider];
  const key = keys[provider] ?? "";
  const serverHasProviderKey = serverProviders.includes(provider);

  const loadModels = async () => {
    setStatus({ loading: true, message: "Loading models..." });
    try {
      const res = await fetch(`/api/provider-models?provider=${provider}`, { headers: key ? { [USER_KEY_HEADER]: key } : {} });
      const body: unknown = await res.json();
      if (!res.ok) {
        const parsed = apiErrorBodySchema.safeParse(body);
        return setStatus({ loading: false, message: parsed.success ? parsed.data.error.message : "Couldn't load models." });
      }
      // Our own API, typed by the route; checked loosely to stay simple.
      const models = (body as { models: ChatModel[] }).models;
      onModelsLoaded(provider, models);
      if (!models.length) return setStatus({ loading: false, message: `No chat models found for this ${name} key.` });
      setStatus({ loading: false, message: `Loaded ${models.length} ${name} models. Switched to ${models[0]?.name ?? "one"}; use the model switcher to pick another.` });
    } catch {
      setStatus({ loading: false, message: "Network error. Try again." });
    }
  };

  return (
    <Card title="API keys (optional)">
      <label htmlFor={`${id}-provider`} className="text-sm font-medium">
        Provider
      </label>
      <select
        id={`${id}-provider`}
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value as ProviderId);
          setStatus({ loading: false, message: "" });
        }}
        className="mt-1.5 mb-3 h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm hover:border-border-strong"
      >
        {PROVIDER_IDS.map((p) => (
          <option key={p} value={p}>
            {PROVIDERS[p].name}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-key`} className="sr-only">
        {name} API key
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-key`}
          type={showKey ? "text" : "password"}
          value={key}
          onChange={(e) => onKeyChange(provider, e.target.value.trim())}
          placeholder={keyHint}
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 font-mono text-sm placeholder:text-muted hover:border-border-strong"
        />
        <button
          type="button"
          onClick={() => setShowKey((s) => !s)}
          aria-label={showKey ? "Hide key" : "Show key"}
          aria-pressed={showKey}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-150 hover:text-fg"
        >
          {showKey ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {provider !== "openrouter" ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={loadModels} disabled={(!key && !serverHasProviderKey) || status.loading}>
          Load models
        </Button>
      ) : null}
      {status.message ? (
        <p role="status" className="mt-2 text-xs">
          {status.message}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {provider !== "openrouter"
          ? serverHasProviderKey
            ? `${name} models are ready via the shared key; paste your own key to use yours instead. `
            : `Paste your ${name} key, then load its models. `
          : serverHasKey
            ? "Leave empty to use the shared key (free models). "
            : "Required: this deployment has no shared key. "}
        Keys stay in this tab&apos;s memory, are sent only with your requests, and are never stored or logged.
      </p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Columns2, History, Trash2 } from "lucide-react";
import { ChatPane } from "@/components/playground/chat-pane";
import { Composer } from "@/components/playground/composer";
import { SettingsPanel } from "@/components/playground/settings-panel";
import { useChat, type ChatSettings } from "@/components/playground/use-chat";
import { Button, buttonClasses } from "@/components/ui/button";
import type { ChatModel } from "@/lib/playground";
import type { ProviderId } from "@/lib/providers";

interface Props {
  models: ChatModel[];
  initialModelId: string;
  /** Default model for the second pane in side-by-side mode. */
  secondModelId: string;
  serverHasKey: boolean;
}

/*
 * State: conversations live in two useChat hooks (pane B is idle unless
 * side-by-side is on). Settings and the optional API keys (one per provider)
 * are plain React state, so keys exist only in this tab's memory: no localStorage, no
 * cookie, gone on reload.
 */
export function Playground({ models: catalogModels, initialModelId, secondModelId, serverHasKey }: Props) {
  // Catalog (OpenRouter) models plus any loaded from providers the user connected.
  const [providerModels, setProviderModels] = useState<ChatModel[]>([]);
  const models = [...catalogModels, ...providerModels];
  const byId = new Map(models.map((m) => [m.id, m]));
  const fallback = models[0];
  const [modelA, setModelA] = useState<ChatModel | undefined>(byId.get(initialModelId) ?? fallback);
  const [modelB, setModelB] = useState<ChatModel | undefined>(byId.get(secondModelId) ?? fallback);
  const [sideBySide, setSideBySide] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({ system: "", temperature: null, maxTokens: null });
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const keyFor = (model: ChatModel | undefined) => keys[(model ?? fallback!).provider] ?? "";

  // Hooks can't be conditional, so both exist; `fallback` guarantees a model object.
  const chatA = useChat({ model: modelA ?? fallback!, settings, apiKey: keyFor(modelA) });
  const chatB = useChat({ model: modelB ?? fallback!, settings, apiKey: keyFor(modelB) });

  /**
   * Replaces this provider's models with a freshly loaded list and switches the
   * first pane to one of them, so the next message uses the new key right away.
   */
  const onModelsLoaded = (provider: ProviderId, loaded: ChatModel[]) => {
    setProviderModels((all) => [...all.filter((m) => m.provider !== provider), ...loaded]);
    if (loaded[0] && modelA?.provider !== provider) setModelA(loaded[0]);
  };

  // Keep ?model= in sync in single mode, so the page can be bookmarked or shared.
  useEffect(() => {
    if (!modelA || sideBySide || modelA.provider !== "openrouter") return;
    const url = `${window.location.pathname}?model=${encodeURIComponent(modelA.id)}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
  }, [modelA, sideBySide]);

  if (!modelA || !modelB) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        The live model list is unavailable right now, so the playground can&apos;t start. Please try again later.
      </p>
    );
  }

  const streaming = chatA.isStreaming || (sideBySide && chatB.isStreaming);
  const send = (text: string) => {
    chatA.send(text);
    if (sideBySide) chatB.send(text);
  };
  const stop = () => {
    chatA.stop();
    chatB.stop();
  };
  const clear = () => {
    chatA.clear();
    chatB.clear();
  };
  const hasMessages = chatA.messages.length > 0 || chatB.messages.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={sideBySide}
          onClick={() => setSideBySide((s) => !s)}
          disabled={streaming}
        >
          <Columns2 className="size-4" aria-hidden />
          {sideBySide ? "Side-by-side on" : "Side-by-side"}
        </Button>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!hasMessages}>
          <Trash2 className="size-4" aria-hidden />
          Clear chat
        </Button>
        <Link href="/history" className={buttonClasses("ghost", "sm")}>
          <History className="size-4" aria-hidden />
          View history
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <div className={sideBySide ? "grid grid-cols-1 gap-3 md:grid-cols-2" : ""}>
            <ChatPane chat={chatA} model={modelA} models={models} onModelChange={setModelA} onSuggestion={send} compact={sideBySide} />
            {sideBySide ? (
              <ChatPane chat={chatB} model={modelB} models={models} onModelChange={setModelB} onSuggestion={send} compact />
            ) : null}
          </div>
          <Composer onSend={send} onStop={stop} streaming={streaming} />
          {sideBySide ? (
            <p className="text-xs text-muted">Each prompt is sent to both models; each keeps its own conversation history.</p>
          ) : null}
        </div>

        <aside aria-label="Playground settings">
          <SettingsPanel
            models={sideBySide ? [modelA, modelB] : [modelA]}
            settings={settings}
            onSettingsChange={setSettings}
            keys={keys}
            onKeyChange={(provider, key) => setKeys((k) => ({ ...k, [provider]: key }))}
            onModelsLoaded={onModelsLoaded}
            serverHasKey={serverHasKey}
          />
        </aside>
      </div>
    </div>
  );
}

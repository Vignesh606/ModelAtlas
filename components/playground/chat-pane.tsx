"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ModelPicker } from "@/components/model-picker";
import { MessageView } from "@/components/playground/message-view";
import type { ChatController } from "@/components/playground/use-chat";
import { Badge } from "@/components/ui/badge";
import { isFree } from "@/lib/catalog";
import type { ChatModel } from "@/lib/playground";
import { modelHref } from "@/lib/routes";

export const SUGGESTIONS = [
  "Explain recursion with a simple code example",
  "Write a Python function that parses JSON safely",
  "What is retrieval-augmented generation (RAG)?",
];

/** One conversation column: model header + switcher, message log, empty state. */
export function ChatPane({
  chat,
  model,
  models,
  onModelChange,
  onSuggestion,
  compact,
}: {
  chat: ChatController;
  model: ChatModel;
  models: ChatModel[];
  onModelChange: (model: ChatModel) => void;
  onSuggestion: (text: string) => void;
  /** Side-by-side mode: shorter log, no suggestions duplicated. */
  compact?: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const byId = new Map(models.map((m) => [m.id, m]));

  // Follow new tokens only if the user hasn't scrolled up to read earlier messages.
  useEffect(() => {
    const log = logRef.current;
    if (log && stickToBottom.current) log.scrollTop = log.scrollHeight;
  }, [chat.messages]);

  return (
    <section aria-label={`Chat with ${model.name}`} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface shadow-card">
      <header className="space-y-3 border-b border-border p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo labName={model.labName} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Link href={modelHref(model.id)} className="truncate rounded hover:underline">
                  {model.name}
                </Link>
                {isFree(model) ? <Badge tone="outline">Free</Badge> : null}
              </p>
              <p className="truncate font-mono text-xs text-muted">{model.id}</p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
            {chat.messages.length} {chat.messages.length === 1 ? "msg" : "msgs"}
          </span>
        </div>
        <ModelPicker
          models={models}
          excludeIds={[model.id]}
          onSelect={onModelChange}
          label={`Switch model (currently ${model.name})`}
          placeholder="Switch model..."
          disabled={chat.isStreaming}
          disabledHint="Wait for the reply to finish to switch models"
        />
      </header>

      <div
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        // role="log" + aria-live: new replies are announced; each streaming reply is aria-busy until done.
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className={`flex-1 space-y-6 overflow-y-auto p-4 sm:p-5 ${compact ? "h-[50vh] min-h-80" : "h-[58vh] min-h-96"}`}
      >
        {chat.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-bg">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="mt-4 font-display text-2xl">What would you like to explore?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Type a prompt below, or start with one of these.</p>
            {!compact ? (
              <ul className="mt-5 flex flex-col items-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => onSuggestion(s)}
                      className="rounded-full border border-border bg-bg px-3.5 py-1.5 text-xs transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          chat.messages.map((message, index) => (
            <MessageView
              key={message.id}
              message={message}
              model={message.role === "assistant" ? byId.get(message.modelId) : undefined}
              isLast={index === chat.messages.length - 1}
              onRegenerate={chat.regenerate}
            />
          ))
        )}
      </div>
    </section>
  );
}

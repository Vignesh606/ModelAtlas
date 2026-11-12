"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  USER_KEY_HEADER,
  apiErrorBodySchema,
  chatEventSchema,
  type ChatError,
  type ChatMessage,
  type ChatRequestInput,
  type ChatUsage,
} from "@/lib/chat";
import type { ChatModel } from "@/lib/playground";
import { createSseParser } from "@/lib/sse";

export interface UserMessage {
  id: number;
  role: "user";
  content: string;
}

export interface AssistantMessage {
  id: number;
  role: "assistant";
  /** Model that produced this reply (the pane's model can change later). */
  modelId: string;
  content: string;
  reasoning: string;
  status: "streaming" | "done" | "stopped" | "error";
  usage: ChatUsage | null;
  latencyMs: number | null;
  finishReason: string | null;
  error: ChatError | null;
}

export type UiMessage = UserMessage | AssistantMessage;

export interface ChatSettings {
  system: string;
  /** null = use the model's default */
  temperature: number | null;
  maxTokens: number | null;
}

/** Fallback messages when an error response has no usable body. */
const STATUS_FALLBACK: Record<number, ChatError> = {
  400: { code: "invalid_request", message: "The request was invalid." },
  401: { code: "unauthorized", message: "The API key was rejected." },
  402: { code: "payment_required", message: "Out of credits." },
  429: { code: "rate_limited", message: "Too many requests. Wait a moment and try again." },
  504: { code: "timeout", message: "The model took too long to respond." },
};

async function readError(response: Response): Promise<ChatError> {
  try {
    const parsed = apiErrorBodySchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error;
  } catch {
    // non-JSON body
  }
  return STATUS_FALLBACK[response.status] ?? { code: "upstream_error", message: `Request failed (${response.status}).` };
}

/** Conversation sent upstream: failed or empty replies are left out. */
function toWire(history: UiMessage[]): ChatMessage[] {
  return history
    .filter((m) => m.role === "user" || (m.status !== "error" && m.content.trim() !== ""))
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * One conversation with one model. Side-by-side mode simply uses two of these.
 * The reply streams into the last assistant message; each SSE event updates it
 * through a functional setState, so updates never read stale state.
 */
export function useChat({ model, settings, apiKey }: { model: ChatModel; settings: ChatSettings; apiKey: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  // Abort any in-flight request when the component unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const last = messages.at(-1);
  const isStreaming = last?.role === "assistant" && last.status === "streaming";

  const run = useCallback(
    async (history: UiMessage[]) => {
      const assistantId = nextId.current++;
      const patch = (update: (m: AssistantMessage) => AssistantMessage) =>
        setMessages((all) => all.map((m) => (m.id === assistantId && m.role === "assistant" ? update(m) : m)));

      setMessages([
        ...history,
        {
          id: assistantId,
          role: "assistant",
          modelId: model.id,
          content: "",
          reasoning: "",
          status: "streaming",
          usage: null,
          latencyMs: null,
          finishReason: null,
          error: null,
        },
      ]);

      const supports = (param: string) => model.supportedParameters.includes(param);
      const request: ChatRequestInput = {
        provider: model.provider,
        model: model.upstreamId,
        messages: toWire(history),
        ...(settings.system.trim() ? { system: settings.system.trim() } : {}),
        ...(settings.temperature !== null && supports("temperature") ? { temperature: settings.temperature } : {}),
        ...(settings.maxTokens !== null && supports("max_tokens") ? { maxTokens: settings.maxTokens } : {}),
      };

      const controller = new AbortController();
      controllerRef.current = controller;
      let finished = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { [USER_KEY_HEADER]: apiKey } : {}) },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const error = await readError(response);
          patch((m) => ({ ...m, status: "error", error }));
          return;
        }

        const parser = createSseParser((data) => {
          let raw: unknown;
          try {
            raw = JSON.parse(data);
          } catch {
            return;
          }
          const parsed = chatEventSchema.safeParse(raw);
          if (!parsed.success) return;
          const event = parsed.data;
          switch (event.type) {
            case "delta":
              patch((m) => ({ ...m, content: m.content + event.text }));
              break;
            case "reasoning":
              patch((m) => ({ ...m, reasoning: m.reasoning + event.text }));
              break;
            case "done":
              finished = true;
              patch((m) => ({ ...m, status: "done", usage: event.usage, latencyMs: event.latencyMs, finishReason: event.finishReason }));
              break;
            case "error":
              finished = true;
              patch((m) => ({ ...m, status: "error", error: event.error }));
              break;
          }
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.flush();

        if (!finished) {
          patch((m) => ({ ...m, status: "error", error: { code: "upstream_error", message: "The connection closed before the reply finished." } }));
        }
      } catch {
        if (controller.signal.aborted) {
          patch((m) => (m.status === "streaming" ? { ...m, status: "stopped" } : m));
        } else {
          patch((m) => ({ ...m, status: "error", error: { code: "upstream_error", message: "Network error. Check your connection and try again." } }));
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [model, settings, apiKey],
  );

  const send = (text: string) => {
    if (isStreaming || !text.trim()) return;
    void run([...messages, { id: nextId.current++, role: "user", content: text }]);
  };

  /** Re-asks the last user message, replacing the reply after it. */
  const regenerate = () => {
    if (isStreaming) return;
    const lastUser = messages.findLastIndex((m) => m.role === "user");
    if (lastUser >= 0) void run(messages.slice(0, lastUser + 1));
  };

  const stop = () => controllerRef.current?.abort();

  const clear = () => {
    controllerRef.current?.abort();
    setMessages([]);
  };

  return { messages, isStreaming, send, regenerate, stop, clear };
}

export type ChatController = ReturnType<typeof useChat>;

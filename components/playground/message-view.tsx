"use client";

import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Markdown } from "@/components/playground/markdown";
import type { AssistantMessage, UiMessage } from "@/components/playground/use-chat";
import { CopyButton } from "@/components/ui/copy-button";
import { compareHref } from "@/lib/compare-url";
import { PROJECTION_REQUESTS_PER_DAY, formatUsd, projectMonthlyCost } from "@/lib/cost";
import { formatInteger } from "@/lib/format";
import type { ChatModel } from "@/lib/playground";

export function MessageView({
  message,
  model,
  isLast,
  onRegenerate,
}: {
  message: UiMessage;
  /** The model that produced this reply, if still in the catalog. */
  model: ChatModel | undefined;
  isLast: boolean;
  onRegenerate: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    );
  }
  return <AssistantView message={message} model={model} isLast={isLast} onRegenerate={onRegenerate} />;
}

function AssistantView({
  message,
  model,
  isLast,
  onRegenerate,
}: {
  message: AssistantMessage;
  model: ChatModel | undefined;
  isLast: boolean;
  onRegenerate: () => void;
}) {
  const streaming = message.status === "streaming";
  const waiting = streaming && message.content === "";

  return (
    // aria-busy while streaming: screen readers wait and announce the finished reply once.
    <article aria-busy={streaming} aria-label={`Reply from ${model?.name ?? message.modelId}`} className="group/msg space-y-2">
      <p className="text-xs font-medium text-muted">{model?.name ?? message.modelId}</p>

      {message.reasoning ? (
        <details className="rounded-lg border border-border bg-bg text-sm" open={waiting}>
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted select-none">
            {waiting ? "Reasoning..." : "Reasoning"}
          </summary>
          <p className="max-h-60 overflow-y-auto border-t border-border px-3 py-2 text-xs whitespace-pre-wrap text-muted">
            {message.reasoning}
          </p>
        </details>
      ) : null}

      {waiting && !message.reasoning ? (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <span className="inline-flex gap-1" aria-hidden>
            <span className="size-1.5 animate-pulse rounded-full bg-muted" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
          </span>
          Thinking
        </p>
      ) : null}

      {message.content ? <Markdown text={message.content} /> : null}

      {message.status === "stopped" ? <p className="text-xs text-muted">Stopped.</p> : null}

      {message.status === "done" && message.finishReason === "length" ? (
        <p className="text-xs text-muted">
          {message.content
            ? "The reply was cut off at the max-tokens limit."
            : "The model used its whole token budget on reasoning. Raise max tokens in Settings and try again."}
        </p>
      ) : null}

      {message.status === "error" && message.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-border-strong bg-bg px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p>{message.error.message}</p>
            {isLast ? (
              <button type="button" onClick={onRegenerate} className="mt-1.5 text-xs font-medium underline underline-offset-2">
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message.status === "done" ? <UsageLine message={message} model={model} /> : null}

      {!streaming && message.content ? (
        <div className="flex items-center gap-1">
          <CopyButton getText={() => message.content} label="Copy reply" />
          {isLast ? (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate reply"
              title="Regenerate reply"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Tokens, latency, and what this usage would cost per month. */
function UsageLine({ message, model }: { message: AssistantMessage; model: ChatModel | undefined }) {
  const usage = message.usage;
  const projection = usage && model ? projectMonthlyCost(usage, model.pricing) : null;

  return (
    <div className="space-y-0.5 text-xs text-muted">
      <p className="font-mono tabular-nums">
        {usage
          ? `${formatInteger(usage.promptTokens)} in · ${formatInteger(usage.completionTokens)} out · ${formatInteger(usage.totalTokens)} tokens`
          : "Token usage not reported"}
        {message.latencyMs !== null ? ` · ${(message.latencyMs / 1000).toFixed(1)}s` : ""}
      </p>
      {projection && model ? (
        <p>
          {projection.monthly === 0
            ? "Free model: $0/mo at any volume (subject to rate limits). "
            : `This request: ${formatUsd(projection.perRequest)} · Projected ${formatUsd(projection.monthly)}/mo at ${PROJECTION_REQUESTS_PER_DAY} requests/day like this. `}
          <Link href={compareHref([model.id])} className="underline underline-offset-2 hover:text-fg">
            Compare costs
          </Link>
        </p>
      ) : null}
    </div>
  );
}

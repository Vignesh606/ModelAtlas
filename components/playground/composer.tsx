"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import { CHAT_LIMITS } from "@/lib/chat";

/**
 * Message input. Enter sends, Shift+Enter adds a newline, Escape stops a
 * streaming reply. IME composition (e.g. Japanese input) is respected so
 * pressing Enter to confirm a character doesn't send the message.
 */
export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const tooLong = text.length > CHAT_LIMITS.maxMessageChars;
  const canSend = !streaming && !disabled && text.trim() !== "" && !tooLong;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && streaming) {
      event.preventDefault();
      onStop();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-xl border border-border bg-bg p-2 focus-within:border-border-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        disabled={disabled}
        placeholder={streaming ? "Generating... (Esc to stop)" : "Ask anything. Enter to send, Shift+Enter for a new line."}
        className="block max-h-48 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-sm [field-sizing:content] placeholder:text-muted focus-visible:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <p className={cn("text-xs tabular-nums", tooLong ? "text-fg" : "text-muted")} aria-live="polite">
          {text.length > CHAT_LIMITS.maxMessageChars * 0.8
            ? `${text.length.toLocaleString("en-US")} / ${CHAT_LIMITS.maxMessageChars.toLocaleString("en-US")} characters${tooLong ? " (too long)" : ""}`
            : ""}
        </p>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-fg transition-opacity duration-150 hover:opacity-90"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-fg transition-opacity duration-150 hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}

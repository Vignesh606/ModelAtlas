"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, FolderGit, Mail, MessageSquare, X } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * Floating Contact button that expands into a small panel (email, GitHub,
 * copy email). Disclosure pattern: aria-expanded/aria-controls on the button,
 * Escape or a click outside closes it and returns focus to the button.
 */
export function Contact() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SITE.contactEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: the mailto link still works.
    }
  };

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-2";

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Contact"
          className="absolute right-0 bottom-full mb-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-2 shadow-card"
        >
          <p className="px-3 pt-1 pb-2 text-xs text-muted">Questions about ModelAtlas?</p>
          <a href={`mailto:${SITE.contactEmail}`} className={item}>
            <Mail className="size-4 text-muted" aria-hidden />
            <span className="truncate">{SITE.contactEmail}</span>
          </a>
          <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className={item}>
            <FolderGit className="size-4 text-muted" aria-hidden />
            GitHub repository
          </a>
          <button type="button" onClick={copyEmail} className={item}>
            {copied ? <Check className="size-4 text-muted" aria-hidden /> : <Copy className="size-4 text-muted" aria-hidden />}
            <span aria-live="polite">{copied ? "Email copied" : "Copy email"}</span>
          </button>
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex size-10 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm text-muted shadow-card transition-colors duration-150 hover:border-border-strong hover:text-fg sm:w-auto sm:px-4"
      >
        {open ? <X className="size-4" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}
        {/* Icon-only on small screens so it covers less content; the label stays for screen readers. */}
        <span className="max-sm:sr-only">Contact</span>
      </button>
    </div>
  );
}

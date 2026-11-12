"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { FAQ } from "@/lib/site-search";

export const OPEN_FAQ_EVENT = "modelatlas:open-faq";

/*
 * Accessible accordion (WAI-ARIA pattern): each question is a <button> with
 * aria-expanded + aria-controls pointing at its answer region. Several can be
 * open at once. Height animates with the grid-rows 0fr -> 1fr technique (pure
 * CSS, no measuring), disabled under reduced motion by the global rule.
 * Closed answers are `inert`, so links inside them can't be tabbed to.
 */
export function Faq() {
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Open an item from /#faq-<id> links (and from the command palette).
  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.replace(/^#faq-/, "");
      if (FAQ.some((f) => f.id === id)) {
        setOpen((current) => new Set(current).add(id));
        document.getElementById(`faq-${id}`)?.scrollIntoView({ block: "center" });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener(OPEN_FAQ_EVENT, openFromHash);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener(OPEN_FAQ_EVENT, openFromHash);
    };
  }, []);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface shadow-card">
      {FAQ.map(({ id, question, answer }) => {
        const isOpen = open.has(id);
        return (
          <div key={id} id={`faq-${id}`} className="scroll-mt-24">
            <h3>
              <button
                type="button"
                id={`faq-${id}-button`}
                aria-expanded={isOpen}
                aria-controls={`faq-${id}-panel`}
                onClick={() => toggle(id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition-colors duration-150 hover:bg-surface-2 sm:text-base"
              >
                {question}
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={`faq-${id}-panel`}
              role="region"
              aria-labelledby={`faq-${id}-button`}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

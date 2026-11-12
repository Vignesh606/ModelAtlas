import type { ReactNode } from "react";

/** Consistent title block for inner pages (the serif face is reserved for the home hero). */
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {children ? <p className="max-w-2xl text-muted">{children}</p> : null}
    </div>
  );
}

import type { ReactNode } from "react";

/** Title block for inner pages. Serif display face, matching the reference design. */
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
      {children ? <p className="max-w-2xl text-muted">{children}</p> : null}
    </div>
  );
}

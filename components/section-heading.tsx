import type { ReactNode } from "react";

/** Eyebrow + title block used by page sections ("FILTER & SELECT / Model catalog"). */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  actions,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">{eyebrow}</p>
        <h2 id={id} className="font-display text-2xl tracking-tight sm:text-3xl">
          {title}
        </h2>
        {description ? <p className="text-sm text-pretty text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

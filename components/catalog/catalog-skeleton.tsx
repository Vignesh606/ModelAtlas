/** Placeholder with the catalog's shape, shown while it streams in. Pulse is disabled under reduced motion. */
export function CatalogSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading models"
      className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex animate-pulse flex-col gap-3">
        <div className="flex gap-3">
          <div className="h-10 flex-1 rounded-lg bg-surface-2" />
          <div className="hidden h-10 w-64 rounded-lg bg-surface-2 sm:block" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-surface-2" />
          ))}
        </div>
        <div className="mt-2 space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-8 rounded-md bg-surface-2" />
              <div className="h-4 flex-1 rounded bg-surface-2" />
              <div className="h-4 w-16 rounded bg-surface-2" />
              <div className="h-4 w-16 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

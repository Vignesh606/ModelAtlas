/** Shown while a not-yet-cached model page renders. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading model" className="animate-pulse space-y-8">
      <div className="h-4 w-24 rounded bg-surface-2" />
      <div className="flex gap-4">
        <div className="size-11 rounded-md bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-64 max-w-full rounded bg-surface-2" />
          <div className="h-4 w-48 rounded bg-surface-2" />
        </div>
      </div>
      <div className="h-24 rounded-2xl bg-surface-2" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

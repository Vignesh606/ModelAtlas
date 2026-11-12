/** Shape of the compare page while it streams in. */
export function CompareSkeleton() {
  return (
    <div role="status" aria-label="Loading comparison" className="animate-pulse space-y-10">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-surface-2" />
      <div className="h-96 rounded-2xl bg-surface-2" />
    </div>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Button>
      <p className="font-mono text-xs text-muted tabular-nums">
        Page {page} of {pageCount}
      </p>
      <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pageCount}>
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

import { Badge } from "@/components/ui/badge";
import { isFree } from "@/lib/catalog";
import { formatScore } from "@/lib/format";
import type { ModelSummary, Score } from "@/lib/types";

/** Small status badges shown next to a model name. */
export function ModelBadges({ model }: { model: ModelSummary }) {
  return (
    <>
      {isFree(model) ? <Badge tone="outline">Free</Badge> : null}
      {model.expiresAt ? <Badge tone="outline" title={`Retires ${model.expiresAt}`}>Deprecated</Badge> : null}
      {model.source === "sample" ? (
        <Badge tone="outline" title="From the assessment's sample data, not the live API">
          Sample
        </Badge>
      ) : null}
    </>
  );
}

/** A benchmark value; sample values get a dagger that the footnote explains. */
export function ScoreValue({ score }: { score: Score | null }) {
  if (!score) return <span className="text-muted">-</span>;
  return (
    <span title={score.source === "sample" ? "Sample value from the assessment brief" : "Artificial Analysis index"}>
      {formatScore(score.value)}
      {score.source === "sample" ? <span className="text-muted">†</span> : null}
    </span>
  );
}

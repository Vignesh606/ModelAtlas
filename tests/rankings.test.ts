import { describe, expect, it } from "vitest";
import { rankModels } from "@/lib/rankings";
import { getSampleModels } from "@/lib/sample-data";
import { toSummary } from "@/lib/summary";

describe("rankModels", () => {
  const models = getSampleModels().map(toSummary);

  it("filters out models without the requested benchmark and sorts descending", () => {
    const withMissing = [
      ...models,
      {
        ...models[0]!,
        id: "test/no-bench",
        name: "No Bench",
        benchmarks: { intelligence: null, coding: null, agentic: null },
      },
    ];
    const ranked = rankModels(withMissing, "intelligence");
    expect(ranked.some((r) => r.model.id === "test/no-bench")).toBe(false);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
    expect(ranked[1]!.score).toBeGreaterThanOrEqual(ranked[2]!.score);
  });

  it("ranks by coding and agentic benchmarks independently", () => {
    const coding = rankModels(models, "coding");
    const agentic = rankModels(models, "agentic");
    expect(coding).toHaveLength(3);
    expect(agentic).toHaveLength(3);
    expect(coding[0]!.score).toBeGreaterThanOrEqual(coding[1]!.score);
    expect(agentic[0]!.score).toBeGreaterThanOrEqual(agentic[1]!.score);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_USAGE,
  formatTokensShort,
  formatUsd,
  lowestIds,
  monthlyCost,
  rankByCost,
  sliderToTokens,
  tokensToSlider,
} from "@/lib/cost";

const terra = { id: "openai/gpt-6.1-terra", pricing: { input: 1, output: 5 } };
const flash = { id: "deepseek/deepseek-v4.1-flash-uncensored", pricing: { input: 0.33, output: 1.32 } };
const sonnet = { id: "anthropic/claude-35-sonnet", pricing: { input: 3, output: 15 } };

describe("monthlyCost", () => {
  it("applies the brief's formula at default usage (5M in, 1M out)", () => {
    expect(monthlyCost(terra.pricing, DEFAULT_USAGE)).toBe(10); // 5*1 + 1*5
    expect(monthlyCost(flash.pricing, DEFAULT_USAGE)).toBeCloseTo(2.97); // 5*0.33 + 1*1.32
    expect(monthlyCost(sonnet.pricing, DEFAULT_USAGE)).toBe(30); // 5*3 + 1*15
  });

  it("is zero for free models and for zero usage", () => {
    expect(monthlyCost({ input: 0, output: 0 }, DEFAULT_USAGE)).toBe(0);
    expect(monthlyCost(terra.pricing, { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("returns null when a price is unknown", () => {
    expect(monthlyCost({ input: null, output: 5 }, DEFAULT_USAGE)).toBeNull();
    expect(monthlyCost({ input: 1, output: null }, DEFAULT_USAGE)).toBeNull();
  });
});

describe("rankByCost", () => {
  it("picks the cheapest and computes savings vs the next best", () => {
    const r = rankByCost([sonnet, terra, flash], DEFAULT_USAGE);
    expect(r.bestId).toBe(flash.id);
    expect(r.runnerUpId).toBe(terra.id);
    expect(r.savings).toBeCloseTo(7.03);
    expect(r.tie).toBe(false);
  });

  it("ignores models with unknown pricing", () => {
    const unknown = { id: "x/router", pricing: { input: null, output: null } };
    const r = rankByCost([unknown, terra], DEFAULT_USAGE);
    expect(r.costs[unknown.id]).toBeNull();
    expect(r.bestId).toBe(terra.id);
    expect(r.savings).toBeNull(); // nothing to compare against
  });

  it("reports a tie instead of a winner", () => {
    const freeA = { id: "a/free", pricing: { input: 0, output: 0 } };
    const freeB = { id: "b/free", pricing: { input: 0, output: 0 } };
    const r = rankByCost([freeA, freeB, terra], DEFAULT_USAGE);
    expect(r.tie).toBe(true);
    expect(r.bestId).toBeNull();
  });

  it("handles an empty selection", () => {
    expect(rankByCost([], DEFAULT_USAGE)).toMatchObject({ bestId: null, savings: null, tie: false });
  });
});

describe("lowestIds", () => {
  it("badges the minimum, including ties at the minimum", () => {
    expect(lowestIds([{ id: "a", value: 1 }, { id: "b", value: 0.33 }, { id: "c", value: 0.33 }])).toEqual(new Set(["b", "c"]));
  });
  it("badges nothing when all values are equal or fewer than two are known", () => {
    expect(lowestIds([{ id: "a", value: 0 }, { id: "b", value: 0 }]).size).toBe(0);
    expect(lowestIds([{ id: "a", value: 1 }, { id: "b", value: null }]).size).toBe(0);
  });
});

describe("formatting", () => {
  it("formats USD", () => {
    expect(formatUsd(2.97)).toBe("$2.97");
    expect(formatUsd(1234)).toBe("$1,234.00");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(null)).toBe("-");
  });
  it("formats token counts", () => {
    expect(formatTokensShort(5_000_000)).toBe("5M");
    expect(formatTokensShort(1_250_000)).toBe("1.25M");
    expect(formatTokensShort(750_000)).toBe("750K");
    expect(formatTokensShort(2_000_000_000)).toBe("2B");
  });
});

describe("log-scale slider", () => {
  it("maps the ends and clamps out-of-range values", () => {
    expect(tokensToSlider(0)).toBe(0);
    expect(tokensToSlider(100_000)).toBe(0);
    expect(tokensToSlider(1_000_000_000)).toBe(1000);
    expect(tokensToSlider(5e10)).toBe(1000);
  });
  it("round-trips the defaults to tidy values", () => {
    expect(sliderToTokens(tokensToSlider(5_000_000))).toBe(5_000_000);
    expect(sliderToTokens(tokensToSlider(1_000_000))).toBe(1_000_000);
    expect(sliderToTokens(tokensToSlider(200_000_000))).toBe(200_000_000);
  });
});

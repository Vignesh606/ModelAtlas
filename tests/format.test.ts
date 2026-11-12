import { describe, expect, it } from "vitest";
import { formatContext, formatDate, formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  it("formats $/1M prices", () => {
    expect(formatPrice(1)).toBe("$1.00");
    expect(formatPrice(0.33)).toBe("$0.33");
    expect(formatPrice(15)).toBe("$15.00");
  });
  it("keeps precision for sub-cent prices", () => {
    expect(formatPrice(0.008)).toBe("$0.008");
    expect(formatPrice(0.0375)).toBe("$0.04");
  });
  it("handles free and unknown", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(null)).toBe("-");
  });
});

describe("formatContext", () => {
  it("uses K and M suffixes", () => {
    expect(formatContext(1_050_000)).toBe("1.05M");
    expect(formatContext(1_000_000)).toBe("1M");
    expect(formatContext(200_000)).toBe("200K");
    expect(formatContext(131_072)).toBe("131K");
    expect(formatContext(512)).toBe("512");
  });
  it("shows '-' for missing values", () => {
    expect(formatContext(null)).toBe("-");
    expect(formatContext(0)).toBe("-");
  });
});

describe("formatDate", () => {
  it("formats ISO dates in UTC", () => {
    expect(formatDate("2026-10-27")).toBe("Oct 27, 2026");
  });
  it("returns '-' for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("not-a-date")).toBe("-");
  });
});

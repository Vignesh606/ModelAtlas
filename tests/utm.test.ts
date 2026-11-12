import { describe, expect, it } from "vitest";
import {
  decodeFirstTouch,
  encodeFirstTouch,
  externalReferrer,
  parseFirstTouch,
  readCookie,
  trackRequestSchema,
} from "@/lib/utm";

const ORIGIN = "https://modelatlas.example";
const NOW = new Date("2026-11-12T10:00:00.000Z");

describe("parseFirstTouch", () => {
  it("captures all five UTM parameters", () => {
    const touch = parseFirstTouch(
      "?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_term=llm+pricing&utm_content=hero",
      "",
      ORIGIN,
      NOW,
    );
    expect(touch).toEqual({
      source: "newsletter",
      medium: "email",
      campaign: "launch",
      term: "llm pricing",
      content: "hero",
      landedAt: "2026-11-12T10:00:00.000Z",
    });
  });

  it("keeps an external referrer without its query string", () => {
    expect(parseFirstTouch("", "https://news.ycombinator.com/item?id=1&token=secret", ORIGIN, NOW)).toEqual({
      referrer: "https://news.ycombinator.com/item",
      landedAt: NOW.toISOString(),
    });
  });

  it("returns null for direct visits and internal referrers", () => {
    expect(parseFirstTouch("?q=gpt", "", ORIGIN, NOW)).toBeNull();
    expect(parseFirstTouch("", `${ORIGIN}/compare`, ORIGIN, NOW)).toBeNull();
  });

  it("cleans hostile values: control characters stripped, length capped, blanks ignored", () => {
    const touch = parseFirstTouch(`?utm_source=%0Aevil%00&utm_campaign=${"x".repeat(300)}&utm_medium=%20%20`, "", ORIGIN, NOW);
    expect(touch?.source).toBe("evil");
    expect(touch?.campaign).toHaveLength(100);
    expect(touch?.medium).toBeUndefined();
  });
});

describe("externalReferrer", () => {
  it("ignores non-http and malformed referrers", () => {
    expect(externalReferrer("javascript:alert(1)", ORIGIN)).toBeUndefined();
    expect(externalReferrer("not a url", ORIGIN)).toBeUndefined();
  });
});

describe("first-touch cookie", () => {
  it("round-trips through encode/decode", () => {
    const touch = parseFirstTouch("?utm_source=x&utm_campaign=y z", "", ORIGIN, NOW);
    expect(decodeFirstTouch(encodeFirstTouch(touch!))).toEqual(touch);
  });

  it("rejects tampered or missing values", () => {
    expect(decodeFirstTouch(undefined)).toBeNull();
    expect(decodeFirstTouch("%7Bnot-json")).toBeNull();
    expect(decodeFirstTouch(encodeURIComponent(JSON.stringify({ source: "x", landedAt: "yesterday" })))).toBeNull();
    expect(decodeFirstTouch(encodeURIComponent(JSON.stringify({ source: "x", landedAt: NOW.toISOString(), extra: 1 })))).toBeNull();
  });

  it("reads a cookie by name", () => {
    expect(readCookie("a=1; ma_consent=analytics; b=x=y", "ma_consent")).toBe("analytics");
    expect(readCookie("a=1; b=x=y", "b")).toBe("x=y");
    expect(readCookie("", "ma_consent")).toBeUndefined();
  });
});

describe("trackRequestSchema", () => {
  it("accepts a page view with or without attribution", () => {
    expect(trackRequestSchema.safeParse({ path: "/compare", firstTouch: null }).success).toBe(true);
    expect(trackRequestSchema.safeParse({ path: "/", firstTouch: { campaign: "launch", landedAt: NOW.toISOString() } }).success).toBe(true);
  });

  it("rejects absolute URLs, oversized paths and unknown fields", () => {
    expect(trackRequestSchema.safeParse({ path: "https://evil.com", firstTouch: null }).success).toBe(false);
    expect(trackRequestSchema.safeParse({ path: `/${"a".repeat(400)}`, firstTouch: null }).success).toBe(false);
    expect(trackRequestSchema.safeParse({ path: "/", firstTouch: null, userId: "x" }).success).toBe(false);
  });
});

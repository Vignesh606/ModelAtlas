import { describe, expect, it } from "vitest";
import { compareHref, parseCompareIds, serializeCompareIds } from "@/lib/compare-url";

const known = new Set(["openai/gpt-6.1-terra", "deepseek/deepseek-v4.1-flash-uncensored", "a/one", "b/two", "c/three", "x/free:free"]);

describe("parseCompareIds", () => {
  it("parses the brief's example URL", () => {
    expect(parseCompareIds("openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored", known)).toEqual([
      "openai/gpt-6.1-terra",
      "deepseek/deepseek-v4.1-flash-uncensored",
    ]);
  });

  it("drops malformed, unknown and duplicate ids, and caps at 4", () => {
    expect(parseCompareIds("a/one,,not-an-id,<script>,a/one,unknown/model,b/two,c/three,x/free:free,openai/gpt-6.1-terra", known)).toEqual([
      "a/one",
      "b/two",
      "c/three",
      "x/free:free",
    ]);
  });

  it("handles missing and array input", () => {
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds(["a/one", "b/two"], known)).toEqual(["a/one", "b/two"]);
  });
});

describe("serializeCompareIds", () => {
  it("keeps slashes and colons readable", () => {
    expect(serializeCompareIds(["a/one", "x/free:free"])).toBe("a/one,x/free:free");
    expect(compareHref(["a/one", "b/two"])).toBe("/compare?models=a/one,b/two");
  });
});

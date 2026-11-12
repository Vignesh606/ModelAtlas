import { describe, expect, it } from "vitest";
import { csvCell, escapeLike, isUuid, parseHistoryQuery, serializeHistoryQuery, toCsv } from "@/lib/history-query";

describe("parseHistoryQuery", () => {
  it("parses valid params", () => {
    expect(parseHistoryQuery({ page: "3", model: "openai/gpt-6.1-terra", q: "recursion" })).toEqual({
      page: 3,
      model: "openai/gpt-6.1-terra",
      q: "recursion",
    });
  });

  it("falls back to defaults for malformed values", () => {
    expect(parseHistoryQuery({ page: "-2", model: "x", q: "  " })).toEqual({ page: 1, model: undefined, q: undefined });
    expect(parseHistoryQuery({ page: "abc" }).page).toBe(1);
    expect(parseHistoryQuery(new URLSearchParams("page=2&q=hi"))).toEqual({ page: 2, model: undefined, q: "hi" });
    expect(parseHistoryQuery({ page: ["4", "5"] }).page).toBe(4);
  });

  it("round-trips through serialize, omitting defaults", () => {
    expect(serializeHistoryQuery({ page: 1 })).toBe("");
    const query = { page: 2, model: "a/b", q: "x y" };
    expect(parseHistoryQuery(new URLSearchParams(serializeHistoryQuery(query)))).toEqual(query);
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("isUuid", () => {
  it("accepts UUIDs only", () => {
    expect(isUuid("0b8f6e7a-3c1d-4e2f-9a8b-7c6d5e4f3a2b")).toBe(true);
    expect(isUuid("1; drop table requests")).toBe(false);
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(csvCell('say "hi", then\nleave')).toBe('"say ""hi"", then\nleave"');
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
  });

  it("neutralises spreadsheet formulas in user text", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(-5)).toBe("-5"); // real numbers are left alone
  });

  it("builds a header and CRLF rows", () => {
    expect(toCsv([{ a: "x", b: 1 }, { a: "y,z", b: null }], ["a", "b"])).toBe('a,b\r\nx,1\r\n"y,z",');
  });
});

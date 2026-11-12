import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG_STATE,
  applyCatalog,
  filterModels,
  parseCatalogParams,
  serializeCatalogParams,
  sortModels,
} from "@/lib/catalog";
import { getSampleModels } from "@/lib/sample-data";
import type { ModelSummary } from "@/lib/types";

const models: ModelSummary[] = getSampleModels();

describe("parseCatalogParams", () => {
  it("parses valid params", () => {
    const state = parseCatalogParams({ q: "claude", lab: "anthropic", caps: "vision,free", sort: "input", dir: "asc", view: "cards", page: "2", size: "25" });
    expect(state).toEqual({ q: "claude", lab: "anthropic", caps: ["vision", "free"], sort: "input", dir: "asc", view: "cards", page: 2, pageSize: 25 });
  });

  it("ignores malformed values instead of throwing", () => {
    const state = parseCatalogParams({ caps: "vision,bogus,vision", sort: "drop table", dir: "up", view: "grid", page: "-3", size: "999" });
    expect(state).toEqual({ ...DEFAULT_CATALOG_STATE, caps: ["vision"] });
  });

  it("accepts URLSearchParams and repeated keys", () => {
    expect(parseCatalogParams(new URLSearchParams("q=gpt&page=abc")).page).toBe(1);
    expect(parseCatalogParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("round-trips through serialize, omitting defaults", () => {
    expect(serializeCatalogParams(DEFAULT_CATALOG_STATE)).toBe("");
    const state = parseCatalogParams({ q: "deep seek", caps: "long", sort: "name", dir: "asc" });
    expect(parseCatalogParams(new URLSearchParams(serializeCatalogParams(state)))).toEqual(state);
  });
});

describe("filter and sort", () => {
  it("matches every search word across name, id and lab", () => {
    expect(filterModels(models, { q: "deepseek flash", lab: null, caps: [] }).map((m) => m.id)).toEqual([
      "deepseek/deepseek-v4.1-flash-uncensored",
    ]);
    expect(filterModels(models, { q: "", lab: null, caps: ["long"] })).toHaveLength(2);
  });

  it("sorts by price and puts missing values last in both directions", () => {
    const withNull: ModelSummary[] = [...models, { ...models[0]!, id: "x/unknown", pricing: { input: null, output: null, cacheRead: null, cacheWrite: null } }];
    expect(sortModels(withNull, "input", "asc").map((m) => m.pricing.input)).toEqual([0.33, 1, 3, null]);
    expect(sortModels(withNull, "input", "desc").map((m) => m.pricing.input)).toEqual([3, 1, 0.33, null]);
  });

  it("clamps an out-of-range page", () => {
    expect(applyCatalog(models, { ...DEFAULT_CATALOG_STATE, page: 99 }).page).toBe(1);
  });

  it("defaults to 10 models per page and respects custom pageSize", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => ({ ...models[0]!, id: `m/${i}`, name: `Model ${i}` }));
    const firstPage = applyCatalog(fifteen, DEFAULT_CATALOG_STATE);
    expect(firstPage.rows).toHaveLength(10);
    expect(firstPage.pageCount).toBe(2);

    const expanded = applyCatalog(fifteen, { ...DEFAULT_CATALOG_STATE, pageSize: 25 });
    expect(expanded.rows).toHaveLength(15);
    expect(expanded.pageCount).toBe(1);
  });
});

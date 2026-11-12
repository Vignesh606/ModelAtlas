import { describe, expect, it } from "vitest";
import { parseEndpointsResponse, parseModelsResponse, perTokenToPerMillion, splitDisplayName } from "@/lib/openrouter";
import { mergeSampleModels } from "@/lib/sample-data";

describe("perTokenToPerMillion", () => {
  it("converts per-token strings to $/1M without float noise", () => {
    expect(perTokenToPerMillion("0.000001")).toBe(1);
    expect(perTokenToPerMillion("0.00000033")).toBe(0.33);
    expect(perTokenToPerMillion("0.000000008")).toBe(0.008);
    expect(perTokenToPerMillion("0")).toBe(0);
  });

  it("returns null for variable (-1), missing or invalid prices", () => {
    expect(perTokenToPerMillion("-1")).toBeNull();
    expect(perTokenToPerMillion(undefined)).toBeNull();
    expect(perTokenToPerMillion("")).toBeNull();
    expect(perTokenToPerMillion("abc")).toBeNull();
  });
});

describe("splitDisplayName", () => {
  it("splits 'Lab: Model'", () => {
    expect(splitDisplayName("OpenAI: GPT-6.1 Terra", "openai")).toEqual({ labName: "OpenAI", name: "GPT-6.1 Terra" });
  });
  it("falls back to the slug when there is no prefix", () => {
    expect(splitDisplayName("Auto Router", "openrouter")).toEqual({ labName: "openrouter", name: "Auto Router" });
  });
});

describe("parseModelsResponse", () => {
  const raw = {
    data: [
      {
        id: "openai/gpt-6.1-terra",
        name: "OpenAI: GPT-6.1 Terra",
        created: 1793038409,
        context_length: 1050000,
        hugging_face_id: "",
        architecture: { input_modalities: ["file", "image", "text"], output_modalities: ["text"] },
        pricing: { prompt: "0.000001", completion: "0.000005" },
        supported_parameters: ["tools", "reasoning", "temperature"],
        benchmarks: { artificial_analysis: { intelligence_index: 51.3, coding_index: null, agentic_index: null } },
      },
      { id: "~openai/alias-latest", name: "Alias", alias_target: { slug: "openai/gpt-6.1-terra" } },
      { id: 42, name: "broken entry" },
    ],
  };

  it("maps valid models and skips aliases and malformed entries", () => {
    const models = parseModelsResponse(raw);
    expect(models).toHaveLength(1);
    const [m] = models;
    expect(m).toMatchObject({
      id: "openai/gpt-6.1-terra",
      name: "GPT-6.1 Terra",
      lab: "openai",
      labName: "OpenAI",
      input: ["text", "image", "pdf"],
      pricing: { input: 1, output: 5, cacheRead: null },
      capabilities: { tools: true, reasoning: true, vision: true, openWeights: false },
      benchmarks: { intelligence: { value: 51.3, source: "artificial-analysis" }, coding: null },
      source: "live",
    });
  });

  it("fills only missing benchmark values from the sample data, tagged as sample", () => {
    const merged = mergeSampleModels(parseModelsResponse(raw));
    const terra = merged.find((m) => m.id === "openai/gpt-6.1-terra");
    expect(terra?.benchmarks.intelligence).toEqual({ value: 51.3, source: "artificial-analysis" });
    expect(terra?.benchmarks.coding).toEqual({ value: 52.4, source: "sample" });
    // Sample models not on OpenRouter are appended so the brief's deep link works.
    expect(merged.map((m) => m.id)).toContain("deepseek/deepseek-v4.1-flash-uncensored");
    expect(merged.find((m) => m.id === "deepseek/deepseek-v4.1-flash-uncensored")?.source).toBe("sample");
  });
});

describe("parseEndpointsResponse", () => {
  it("keeps the cheapest endpoint per provider", () => {
    const providers = parseEndpointsResponse({
      data: {
        endpoints: [
          { provider_name: "OpenAI", pricing: { prompt: "0.000001", completion: "0.000005" }, quantization: "unknown" },
          { provider_name: "OpenAI", pricing: { prompt: "0.0000005", completion: "0.0000025" } },
          { provider_name: "Azure", pricing: { prompt: "0.000001", completion: "0.000005" }, quantization: "fp8" },
        ],
      },
    });
    expect(providers).toEqual([
      { name: "OpenAI", inputPrice: 0.5, outputPrice: 2.5, context: null, quantization: null },
      { name: "Azure", inputPrice: 1, outputPrice: 5, context: null, quantization: "fp8" },
    ]);
  });
});

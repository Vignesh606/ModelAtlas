import { z } from "zod";
import rawSampleModels from "@/lib/data/dummy-models.json";
import type { Benchmarks, Model, Score } from "@/lib/types";

/*
 * The three sample models from the assessment brief (dummy-models.json).
 * Used (1) as the fallback when OpenRouter is unreachable, (2) to supply
 * benchmark values that the live API lacks, labelled as "sample" in the UI,
 * and (3) in tests. The JSON is validated with zod so a typo fails loudly.
 */

const modality = z.enum(["text", "image", "audio", "video", "pdf"]);

const sampleModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  lab: z.string(),
  description: z.string(),
  context: z.number(),
  input: z.array(modality),
  output: z.array(modality),
  cost: z.object({
    input: z.number().nullable(),
    output: z.number().nullable(),
    cacheRead: z.number().nullable(),
    cacheWrite: z.number().nullable(),
  }),
  intelligence: z.number().nullable(),
  coding: z.number().nullable(),
  agentic: z.number().nullable(),
  providers: z.array(z.string()),
});

type SampleModel = z.infer<typeof sampleModelSchema>;

const sampleModels: SampleModel[] = z.array(sampleModelSchema).parse(rawSampleModels);

/** Ids of the brief's sample models, used for prerendering and as compare suggestions. */
export const SAMPLE_MODEL_IDS: readonly string[] = sampleModels.map((m) => m.id);

const LAB_NAMES: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  anthropic: "Anthropic",
};

const sampleScore = (value: number | null): Score | null =>
  value === null ? null : { value, source: "sample" };

export function sampleBenchmarks(model: SampleModel): Benchmarks {
  return {
    intelligence: sampleScore(model.intelligence),
    coding: sampleScore(model.coding),
    agentic: sampleScore(model.agentic),
  };
}

export function sampleToModel(sample: SampleModel): Model {
  return {
    id: sample.id,
    name: sample.name,
    lab: sample.lab,
    labName: LAB_NAMES[sample.lab] ?? sample.lab,
    description: sample.description,
    context: sample.context,
    maxOutput: null,
    input: sample.input,
    output: sample.output,
    pricing: { ...sample.cost },
    releasedAt: null, // not in the sample data; shown as "-"
    expiresAt: null,
    capabilities: {
      reasoning: false,
      tools: false,
      vision: sample.input.includes("image"),
      openWeights: false,
    },
    supportedParameters: [],
    benchmarks: sampleBenchmarks(sample),
    providers: sample.providers,
    source: "sample",
  };
}

/**
 * Merges the sample models into the live list:
 * - if a sample id exists live, keep the live record and only fill benchmark
 *   values the live API is missing (each tagged "sample");
 * - otherwise append the sample record so deep links from the brief still work.
 */
export function mergeSampleModels(live: Model[]): Model[] {
  const byId = new Map(live.map((m) => [m.id, m]));
  const merged = [...live];

  for (const sample of sampleModels) {
    const existing = byId.get(sample.id);
    if (!existing) {
      merged.push(sampleToModel(sample));
      continue;
    }
    const fallback = sampleBenchmarks(sample);
    const index = merged.indexOf(existing);
    merged[index] = {
      ...existing,
      benchmarks: {
        intelligence: existing.benchmarks.intelligence ?? fallback.intelligence,
        coding: existing.benchmarks.coding ?? fallback.coding,
        agentic: existing.benchmarks.agentic ?? fallback.agentic,
      },
    };
  }
  return merged;
}

export function getSampleModels(): Model[] {
  return sampleModels.map(sampleToModel);
}

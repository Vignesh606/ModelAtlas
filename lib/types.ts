/**
 * Shared domain types. Everything UI-facing is built on `Model`, regardless of
 * whether the record came from the live OpenRouter API or the sample JSON.
 */

/** Input/output modalities. OpenRouter's "file" input means PDFs, so we name it "pdf". */
export type Modality = "text" | "image" | "audio" | "video" | "pdf";

/**
 * Where a benchmark number came from. Tracked per value so the UI can label
 * sample numbers honestly instead of mixing them silently with real ones.
 */
export type BenchmarkSource = "artificial-analysis" | "sample";

export interface Score {
  value: number;
  source: BenchmarkSource;
}

export interface Benchmarks {
  intelligence: Score | null;
  coding: Score | null;
  agentic: Score | null;
}

/** USD per 1M tokens. `null` means unknown or variable (e.g. router models). */
export interface Pricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

export interface Capabilities {
  reasoning: boolean;
  tools: boolean;
  vision: boolean;
  /** Derived from OpenRouter's `hugging_face_id`: weights are published on Hugging Face. */
  openWeights: boolean;
}

export interface Model {
  /** OpenRouter id, e.g. "openai/gpt-6.1-terra". Contains a slash. */
  id: string;
  name: string;
  /** Lab slug, the part of the id before the slash, e.g. "openai". */
  lab: string;
  /** Display name, e.g. "OpenAI". */
  labName: string;
  description: string;
  /** Context window in tokens. */
  context: number | null;
  maxOutput: number | null;
  input: Modality[];
  output: Modality[];
  pricing: Pricing;
  /** ISO date (YYYY-MM-DD). */
  releasedAt: string | null;
  /** ISO date after which the model is retired; presence means "deprecated". */
  expiresAt: string | null;
  capabilities: Capabilities;
  /** Request parameters the model accepts (temperature, max_tokens...). Used by the playground. */
  supportedParameters: string[];
  benchmarks: Benchmarks;
  /** Provider names known without an extra request (sample data only). */
  providers: string[];
  /** "sample" = record only exists in dummy-models.json, it cannot be called via OpenRouter. */
  source: "live" | "sample";
}

/** Slim version sent to client components: drops the long text fields. */
export type ModelSummary = Omit<Model, "description" | "supportedParameters">;

export interface Catalog {
  models: Model[];
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
  /** "fallback" when the live API failed and only sample data is shown. */
  status: "live" | "fallback";
}

/** One hosting provider for a model, from OpenRouter's /endpoints route. */
export interface ProviderListing {
  name: string;
  inputPrice: number | null;
  outputPrice: number | null;
  context: number | null;
  quantization: string | null;
}

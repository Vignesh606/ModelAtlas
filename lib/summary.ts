import type { Model, ModelSummary } from "@/lib/types";

/** Strips long text fields before a model list is sent to a client component. */
export function toSummary(model: Model): ModelSummary {
  const { description, supportedParameters, ...summary } = model;
  return summary;
}

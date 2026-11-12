import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getModel, getProviders } from "@/lib/data";

/**
 * GET /api/providers?model=openai/gpt-6.1-terra -> { providers: string[] }
 *
 * /compare renders providers for the models in the URL on the server; this
 * endpoint covers models added afterwards on the client. Results come from the
 * hourly cache in lib/data.ts, and the CDN may cache the response for an hour.
 */
const querySchema = z.object({ model: z.string().trim().min(3).max(200) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ model: request.nextUrl.searchParams.get("model") });
  if (!parsed.success) {
    return apiError("invalid_request", "Query parameter 'model' is required.", 400);
  }

  const model = await getModel(parsed.data.model);
  if (!model) return apiError("not_found", `Unknown model '${parsed.data.model}'.`, 404);

  const providers = await getProviders(model);
  return Response.json(
    { providers: providers.map((p) => p.name) },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

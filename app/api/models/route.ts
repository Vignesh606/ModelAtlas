import { listModels } from "@/lib/data";

/**
 * GET /api/models -> a slim list for the command palette. Fetched only when
 * the palette first opens, so pages don't carry the whole catalog up front.
 */
export async function GET() {
  const models = (await listModels()).map((m) => ({
    id: m.id,
    name: m.name,
    labName: m.labName,
    inputPrice: m.pricing.input,
  }));
  return Response.json(
    { models },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

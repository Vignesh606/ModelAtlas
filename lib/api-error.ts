/**
 * Every API route returns errors in one shape: { error: { code, message } },
 * so the client can show a friendly message for any failure.
 */
export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "unauthorized"
  | "payment_required"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "internal_error";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export function apiError(code: ApiErrorCode, message: string, status: number, headers?: HeadersInit): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers });
}

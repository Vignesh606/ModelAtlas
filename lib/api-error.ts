/**
 * Every API route returns errors in one shape: { error: { code, message } },
 * so the client can show a friendly message for any failure.
 */
export const API_ERROR_CODES = [
  "invalid_request",
  "not_found",
  "unauthorized",
  "payment_required",
  "rate_limited",
  "upstream_error",
  "timeout",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export function apiError(code: ApiErrorCode, message: string, status: number, headers?: HeadersInit): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers });
}

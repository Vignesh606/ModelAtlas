import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before routing. Next decodes catch-all params itself, and a malformed
 * percent-encoding (e.g. /models/%E0%A4) makes that decode throw, which would
 * surface as a 500. We reject those URLs up front with a clean 400 instead.
 */
export function proxy(request: NextRequest) {
  try {
    decodeURIComponent(request.nextUrl.pathname);
    return NextResponse.next();
  } catch {
    return new NextResponse("Bad request: malformed URL encoding.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: "/models/:path*",
};

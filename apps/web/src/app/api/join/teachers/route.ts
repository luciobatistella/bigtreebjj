import { NextRequest, NextResponse } from "next/server";
import {
  checkPublicRateLimit,
  forwardedClientHeaders,
  protectedPublicHeaders
} from "../../publicAccess";

const apiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) {
    return NextResponse.json([], { headers: protectedPublicHeaders });
  }
  const rate = checkPublicRateLimit(request, "teacher-search", 90, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas em sequência. Tente novamente mais tarde." },
      {
        status: 429,
        headers: {
          ...protectedPublicHeaders,
          ...rate.headers,
          "Retry-After": "600"
        }
      }
    );
  }
  try {
    const response = await fetch(`${apiBase}/community/teachers?q=${encodeURIComponent(query)}`, {
      headers: forwardedClientHeaders(request),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => []);
    return NextResponse.json(payload, {
      status: response.status,
      headers: { ...protectedPublicHeaders, ...rate.headers }
    });
  } catch {
    return NextResponse.json([], {
      status: 502,
      headers: { ...protectedPublicHeaders, ...rate.headers }
    });
  }
}

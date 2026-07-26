import { NextRequest, NextResponse } from "next/server";
import {
  checkPublicRateLimit,
  forwardedClientHeaders,
  protectedPublicHeaders
} from "../../publicAccess";

const internalApiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rate = checkPublicRateLimit(request, "public-person", 120, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many lineage requests. Please try again later." },
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
    const response = await fetch(
      `${internalApiBase}/public/people/${encodeURIComponent(params.id)}`,
      {
        headers: forwardedClientHeaders(request),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000)
      }
    );
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        ...protectedPublicHeaders,
        ...rate.headers
      }
    });
  } catch {
    return NextResponse.json(
      { error: "The lineage API could not be reached." },
      { status: 502 }
    );
  }
}

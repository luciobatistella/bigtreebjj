import { NextRequest, NextResponse } from "next/server";

const apiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json([]);
  try {
    const response = await fetch(`${apiBase}/community/teachers?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => []);
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

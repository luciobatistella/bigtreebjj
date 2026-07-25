import { NextResponse } from "next/server";

const internalApiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(
      `${internalApiBase}/public/people/${encodeURIComponent(params.id)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000)
      }
    );
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "The lineage API could not be reached." },
      { status: 502 }
    );
  }
}

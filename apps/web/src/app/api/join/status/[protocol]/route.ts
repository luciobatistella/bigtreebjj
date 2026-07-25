import { NextResponse } from "next/server";

const apiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function GET(_request: Request, { params }: { params: { protocol: string } }) {
  try {
    const response = await fetch(
      `${apiBase}/community/lineage-submissions/status/${encodeURIComponent(params.protocol)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      }
    );
    const payload = await response.json().catch(() => ({ error: "Resposta inválida da API." }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o protocolo." }, { status: 502 });
  }
}

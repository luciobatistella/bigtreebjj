import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  isAdminUser
} from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxyAdminRequest(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Sessão editorial ausente." }, { status: 401 });
    }
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Acesso editorial não autorizado." }, { status: 403 });
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ error: "Sessão editorial expirada." }, { status: 401 });
    }

    const internalApiUrl =
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:3001";
    const upstreamUrl = new URL(
      `/${params.path.map(encodeURIComponent).join("/")}`,
      internalApiUrl
    );
    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value);
    });

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const accept = request.headers.get("accept");
    if (contentType) headers.set("Content-Type", contentType);
    if (accept) headers.set("Accept", accept);
    headers.set("Authorization", `Bearer ${session.access_token}`);

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
      cache: "no-store"
    });

    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-disposition", "content-length"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "private, no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "O serviço editorial está temporariamente indisponível.",
        detail: process.env.NODE_ENV === "development" ? (error as Error).message : undefined
      },
      { status: 502 }
    );
  }
}

export const GET = proxyAdminRequest;
export const POST = proxyAdminRequest;
export const PUT = proxyAdminRequest;
export const PATCH = proxyAdminRequest;
export const DELETE = proxyAdminRequest;

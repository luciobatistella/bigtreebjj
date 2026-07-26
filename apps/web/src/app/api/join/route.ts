import { NextRequest, NextResponse } from "next/server";
import { localeCookieName, normalizeLocale } from "../../i18n/locale";
import {
  translateJoinApiMessage,
  translateJoinApiPayload
} from "../../i18n/joinApiErrors";
import { forwardedClientHeaders } from "../publicAccess";

const apiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function POST(request: NextRequest) {
  let locale = normalizeLocale(request.cookies.get(localeCookieName)?.value);
  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    let body: FormData | string;
    if (isMultipart) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      if (typeof rawPayload === "string") {
        try {
          locale = normalizeLocale(
            (JSON.parse(rawPayload) as { locale?: string }).locale ?? locale
          );
        } catch {
          // A API retornará o erro de payload; mantemos o idioma do cookie.
        }
      }
      body = formData;
    } else {
      const json = (await request.json()) as { locale?: string };
      locale = normalizeLocale(json.locale ?? locale);
      body = JSON.stringify(json);
    }
    const response = await fetch(`${apiBase}/community/lineage-submissions`, {
      method: "POST",
      headers: isMultipart
        ? forwardedClientHeaders(request)
        : {
            ...forwardedClientHeaders(request),
            "Content-Type": "application/json"
          },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
    const payload = await response
      .json()
      .catch(() => ({ error: translateJoinApiMessage("Resposta inválida da API.", locale) }));
    return NextResponse.json(translateJoinApiPayload(payload, locale), {
      status: response.status
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: translateJoinApiMessage("Não foi possível enviar sua solicitação.", locale),
        detail:
          error instanceof Error
            ? error.message
            : translateJoinApiMessage("Erro desconhecido", locale)
      },
      { status: 502 }
    );
  }
}

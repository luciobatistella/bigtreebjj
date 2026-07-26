import { type NextRequest, NextResponse } from "next/server";
import { buildUnifiedForest } from "./unifiedForest";
import { normalizeLocale } from "../../../i18n/locale";
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

export async function GET(request: NextRequest) {
  const locale = normalizeLocale(request.nextUrl.searchParams.get("locale"));
  const rate = checkPublicRateLimit(request, "explore-forest", 24, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          locale === "en"
            ? "Too many tree reloads. Please try again in a few minutes."
            : "Muitos recarregamentos da árvore. Tente novamente em alguns minutos."
      },
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
    const response = await fetch(`${internalApiBase}/explore/forest`, {
      headers: forwardedClientHeaders(request),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            locale === "en"
              ? `The lineage API responded with status ${response.status}.`
              : `A API de linhagens respondeu com status ${response.status}.`
        },
        { status: response.status }
      );
    }

    const postgresForest = (await response.json()) as unknown;
    if (!Array.isArray(postgresForest)) {
      return NextResponse.json(
        {
          error:
            locale === "en"
              ? "The lineage API returned an unexpected format."
              : "A API de linhagens retornou um formato inesperado."
        },
        { status: 502 }
      );
    }

    return NextResponse.json([buildUnifiedForest(postgresForest, locale)], {
      headers: {
        ...protectedPublicHeaders,
        ...rate.headers
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          locale === "en"
            ? "The lineage API could not be reached."
            : "Não foi possível conectar à API de linhagens.",
        detail:
          error instanceof Error
            ? error.message
            : locale === "en"
              ? "Unknown error"
              : "Erro desconhecido"
      },
      { status: 502 }
    );
  }
}

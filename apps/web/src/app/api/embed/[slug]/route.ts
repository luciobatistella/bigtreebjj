import { type NextRequest, NextResponse } from "next/server";
import type { Locale } from "../../../i18n/locale";
import { normalizeLocale } from "../../../i18n/locale";
import { PUBLIC_LINEAGE_PORTRAITS } from "../../../explore/motion/publicLineagePortraits";
import type { LineageEmbedPayload } from "../../../embed/embedTypes";
import { buildUnifiedForest, type UnifiedForestNode } from "../../explore/forest/unifiedForest";
import {
  checkPublicRateLimit,
  forwardedClientHeaders,
  protectedPublicHeaders
} from "../../publicAccess";

const internalApiBase =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

const MAX_DIRECT_BLACK_BELTS = 8;
const CACHE_TTL_MS = 2 * 60 * 1000;

type ForestCacheEntry = {
  expiresAt: number;
  root: UnifiedForestNode;
};

const globalEmbedCache = globalThis as typeof globalThis & {
  __tbtEmbedForestCache?: Partial<Record<Locale, ForestCacheEntry>>;
};

const forestCache =
  globalEmbedCache.__tbtEmbedForestCache ??
  (globalEmbedCache.__tbtEmbedForestCache = {});

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isEditorialGroup(node: UnifiedForestNode) {
  return node.id.startsWith("unified:");
}

function findLineage(
  node: UnifiedForestNode,
  slug: string,
  path: UnifiedForestNode[] = []
): UnifiedForestNode[] | null {
  const nextPath = isEditorialGroup(node) ? path : [...path, node];
  if (!isEditorialGroup(node) && slugify(node.name) === slug) return nextPath;

  for (const child of node.children ?? []) {
    const match = findLineage(child, slug, nextPath);
    if (match) return match;
  }
  return null;
}

async function getUnifiedForest(request: NextRequest, locale: Locale) {
  const cached = forestCache[locale];
  if (cached && cached.expiresAt > Date.now()) return cached.root;

  const response = await fetch(`${internalApiBase}/explore/forest`, {
    headers: forwardedClientHeaders(request),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`LINEAGE_API_${response.status}`);
  }

  const postgresForest = (await response.json()) as unknown;
  if (!Array.isArray(postgresForest)) {
    throw new Error("LINEAGE_API_FORMAT");
  }

  const root = buildUnifiedForest(postgresForest, locale);
  forestCache[locale] = {
    root,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return root;
}

function buildPayload(root: UnifiedForestNode, slug: string): LineageEmbedPayload | null {
  const lineage = findLineage(root, slug);
  if (!lineage?.length) return null;

  const person = lineage.at(-1);
  if (!person) return null;
  const children = (person.children ?? []).filter((child) => !isEditorialGroup(child));
  const directBlackBelts = children.slice(0, MAX_DIRECT_BLACK_BELTS);

  return {
    version: 1,
    person: {
      name: person.name,
      slug,
      team: person.team ?? "",
      portrait: PUBLIC_LINEAGE_PORTRAITS[person.id]
    },
    lineage: lineage.map((member) => ({
      name: member.name,
      slug: slugify(member.name),
      relationLabel: member.relationLabel ?? ""
    })),
    generation: lineage.length,
    directBlackBelts: {
      total: children.length,
      shown: directBlackBelts.length,
      items: directBlackBelts.map((member) => ({
        name: member.name,
        slug: slugify(member.name)
      }))
    },
    canonicalPath: `/in/${slug}`,
    limits: {
      maxDirectBlackBelts: MAX_DIRECT_BLACK_BELTS,
      biographiesIncluded: false,
      evidenceDocumentsIncluded: false,
      brandingRequired: true
    }
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const locale = normalizeLocale(request.nextUrl.searchParams.get("locale"));
  const slug = slugify(decodeURIComponent(params.slug).slice(0, 120));
  const rate = checkPublicRateLimit(request, "lineage-embed", 60, 10 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          locale === "en"
            ? "Too many widget reloads. Please try again shortly."
            : "Muitos recarregamentos do widget. Tente novamente em instantes."
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

  if (!slug) {
    return NextResponse.json(
      { error: locale === "en" ? "Invalid person." : "Pessoa inválida." },
      { status: 400, headers: protectedPublicHeaders }
    );
  }

  try {
    const root = await getUnifiedForest(request, locale);
    const payload = buildPayload(root, slug);
    if (!payload) {
      return NextResponse.json(
        {
          error:
            locale === "en"
              ? "This person does not have a public approved lineage."
              : "Esta pessoa não possui uma linhagem pública aprovada."
        },
        {
          status: 404,
          headers: { ...protectedPublicHeaders, ...rate.headers }
        }
      );
    }

    return NextResponse.json(payload, {
      headers: { ...protectedPublicHeaders, ...rate.headers }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.startsWith("LINEAGE_API_")
      ? Number(message.replace("LINEAGE_API_", "")) || 502
      : 502;
    return NextResponse.json(
      {
        error:
          locale === "en"
            ? "The official lineage could not be loaded."
            : "Não foi possível carregar a linhagem oficial."
      },
      {
        status,
        headers: { ...protectedPublicHeaders, ...rate.headers }
      }
    );
  }
}

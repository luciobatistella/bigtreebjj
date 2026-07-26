import type { NextRequest } from "next/server";

type RateWindow = {
  attempts: number[];
};

const globalRateStore = globalThis as typeof globalThis & {
  __tbtPublicRateStore?: Map<string, RateWindow>;
};

const rateStore =
  globalRateStore.__tbtPublicRateStore ??
  (globalRateStore.__tbtPublicRateStore = new Map<string, RateWindow>());

export function clientAddress(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function forwardedClientHeaders(request: NextRequest) {
  return {
    "X-Forwarded-For": clientAddress(request),
    "User-Agent": request.headers.get("user-agent") ?? "TheBigTreeBJJ-Web"
  };
}

export function checkPublicRateLimit(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const key = `${bucket}:${clientAddress(request)}`;
  const recent = (rateStore.get(key)?.attempts ?? []).filter(
    (attempt) => attempt > now - windowMs
  );
  const allowed = recent.length < limit;
  if (allowed) {
    recent.push(now);
    rateStore.set(key, { attempts: recent });
  }
  if (rateStore.size > 10_000) {
    for (const [candidateKey, window] of rateStore) {
      if (!window.attempts.some((attempt) => attempt > now - windowMs)) {
        rateStore.delete(candidateKey);
      }
    }
  }
  return {
    allowed,
    headers: {
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(Math.max(0, limit - recent.length)),
      "RateLimit-Reset": String(Math.ceil(windowMs / 1000))
    }
  };
}

export const protectedPublicHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  "X-The-Big-Tree-BJJ-Use": "No automated bulk extraction"
};

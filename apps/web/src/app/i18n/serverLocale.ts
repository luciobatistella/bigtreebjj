import "server-only";
import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale, type Locale } from "./locale";

export function getServerLocale(): Locale {
  return normalizeLocale(cookies().get(localeCookieName)?.value);
}

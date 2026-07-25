"use client";

import { usePathname, useRouter } from "next/navigation";
import { commonCopy, localeCookieName, type Locale } from "./locale";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith("/admin")) return null;

  const selectLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale === "en" ? "en" : "pt-BR";
    router.refresh();
  };

  return (
    <div
      className="tbt-language-switcher"
      role="group"
      aria-label={commonCopy[locale].languageToggle}
    >
      <button
        type="button"
        className={locale === "pt" ? "is-active" : ""}
        onClick={() => selectLocale("pt")}
        aria-pressed={locale === "pt"}
        title="Português"
      >
        PT
      </button>
      <span aria-hidden="true" />
      <button
        type="button"
        className={locale === "en" ? "is-active" : ""}
        onClick={() => selectLocale("en")}
        aria-pressed={locale === "en"}
        title="English"
      >
        EN
      </button>
    </div>
  );
}

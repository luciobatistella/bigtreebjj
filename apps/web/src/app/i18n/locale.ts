export type Locale = "pt" | "en";

export const localeCookieName = "tbt_locale";

export function normalizeLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith("en") ? "en" : "pt";
}

export const commonCopy = {
  pt: {
    languageName: "Português",
    languageToggle: "Selecionar idioma",
    home: "Início",
    explorer: "Explorer",
    openExplorer: "Abrir Explorer",
    backToExplorer: "Voltar ao Explorer",
    backHome: "Voltar à home",
    loading: "Carregando…",
    close: "Fechar",
    search: "Buscar",
    retry: "Tentar novamente"
  },
  en: {
    languageName: "English",
    languageToggle: "Select language",
    home: "Home",
    explorer: "Explorer",
    openExplorer: "Open Explorer",
    backToExplorer: "Back to Explorer",
    backHome: "Back to home",
    loading: "Loading…",
    close: "Close",
    search: "Search",
    retry: "Try again"
  }
} as const;

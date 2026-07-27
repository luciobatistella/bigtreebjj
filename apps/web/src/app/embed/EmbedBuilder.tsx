"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmbedLocale, EmbedTheme, EmbedView } from "./embedTypes";

type Teacher = {
  id: string;
  fullName: string;
  team?: string | null;
  country?: string | null;
};

const productionOrigin = "https://bigtreebjj.com";

const builderCopy = {
  pt: {
    eyebrow: "The Big Tree BJJ · Official Embed",
    title: "A árvore oficial, dentro de qualquer site.",
    intro:
      "Academias, professores e atletas podem publicar uma linhagem aprovada sem duplicar o nosso acervo.",
    select: "Escolha a pessoa",
    search: "Digite pelo menos duas letras",
    language: "Idioma",
    theme: "Tema",
    view: "Formato",
    views: {
      full: "Completo",
      lineage: "Só linhagem",
      compact: "Compacto"
    },
    themes: {
      gold: "Ouro editorial",
      light: "Claro"
    },
    preview: "Prévia ao vivo",
    code: "Código para publicar",
    copy: "Copiar código",
    copied: "Código copiado",
    limitsTitle: "O que o widget entrega",
    limits: [
      "Somente pessoas e vínculos já publicados na árvore oficial.",
      "Até 8 faixas-pretas diretamente conectados; o restante continua no Explorer.",
      "Sem biografias, certificados, documentos de evidência ou identificadores internos.",
      "Assinatura e link para The Big Tree BJJ permanecem visíveis."
    ],
    note:
      "“Oficial” identifica o registro editorial publicado pelo The Big Tree BJJ; não representa homologação de uma federação.",
    back: "Voltar à home",
    loading: "Buscando…",
    noResults: "Nenhuma pessoa aprovada encontrada."
  },
  en: {
    eyebrow: "The Big Tree BJJ · Official Embed",
    title: "The official tree, inside any website.",
    intro:
      "Academies, instructors and athletes can publish an approved lineage without duplicating our archive.",
    select: "Choose the person",
    search: "Type at least two letters",
    language: "Language",
    theme: "Theme",
    view: "Format",
    views: {
      full: "Full",
      lineage: "Lineage only",
      compact: "Compact"
    },
    themes: {
      gold: "Editorial gold",
      light: "Light"
    },
    preview: "Live preview",
    code: "Publishing code",
    copy: "Copy code",
    copied: "Code copied",
    limitsTitle: "What the widget delivers",
    limits: [
      "Only people and relationships already published in the official tree.",
      "Up to 8 directly connected black belts; the rest stays in the Explorer.",
      "No biographies, certificates, evidence documents or internal identifiers.",
      "The Big Tree BJJ signature and link remain visible."
    ],
    note:
      "“Official” identifies the editorial record published by The Big Tree BJJ; it is not federation certification.",
    back: "Back home",
    loading: "Searching…",
    noResults: "No approved person found."
  }
} as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function EmbedBuilder({ locale }: { locale: EmbedLocale }) {
  const text = builderCopy[locale];
  const [query, setQuery] = useState("Demian Maia");
  const [personName, setPersonName] = useState("Demian Maia");
  const [personSlug, setPersonSlug] = useState("demian-maia");
  const [results, setResults] = useState<Teacher[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [theme, setTheme] = useState<EmbedTheme>("gold");
  const [view, setView] = useState<EmbedView>("full");
  const [widgetLocale, setWidgetLocale] = useState<EmbedLocale>(locale);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || search === personName) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/join/teachers?q=${encodeURIComponent(search)}`, {
        signal: controller.signal
      })
        .then((response) => response.json())
        .then((body: unknown) => setResults(Array.isArray(body) ? body : []))
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearching(false);
            setSearched(true);
          }
        });
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [personName, query]);

  const code = useMemo(
    () =>
      `<script async src="${productionOrigin}/embed/widget.js"></script>\n` +
      `<the-big-tree-bjj person="${personSlug}" lang="${widgetLocale}" theme="${theme}" view="${view}"></the-big-tree-bjj>`,
    [personSlug, theme, view, widgetLocale]
  );

  const previewSource = `/embed/${personSlug}?lang=${widgetLocale}&theme=${theme}&view=${view}`;

  const selectPerson = (person: Teacher) => {
    setPersonName(person.fullName);
    setPersonSlug(slugify(person.fullName));
    setQuery(person.fullName);
    setResults([]);
    setSearched(false);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="embed-builder">
      <div className="embed-builder-orbit" aria-hidden="true" />
      <nav>
        <a href="/">
          <img src="/logo-embed.webp" width="48" height="48" alt="" />
          <span>The Big Tree BJJ</span>
        </a>
        <a href="/">{text.back} <span aria-hidden="true">↗</span></a>
      </nav>

      <header>
        <small>{text.eyebrow}</small>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </header>

      <section className="embed-builder-workbench">
        <div className="embed-builder-controls">
          <div className="embed-builder-search">
            <label htmlFor="embed-person">{text.select}</label>
            <div>
              <input
                id="embed-person"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.search}
                autoComplete="off"
              />
              <span aria-hidden="true">⌕</span>
            </div>
            {query.trim().length >= 2 && query !== personName ? (
              <div className="embed-builder-results">
                {searching ? <p>{text.loading}</p> : null}
                {!searching && searched && !results.length ? <p>{text.noResults}</p> : null}
                {results.map((person) => (
                  <button key={person.id} type="button" onClick={() => selectPerson(person)}>
                    <span>{person.fullName}</span>
                    <small>{[person.team, person.country].filter(Boolean).join(" · ")}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="embed-builder-field">
            <label htmlFor="embed-lang">{text.language}</label>
            <select
              id="embed-lang"
              value={widgetLocale}
              onChange={(event) => setWidgetLocale(event.target.value as EmbedLocale)}
            >
              <option value="pt">Português</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="embed-builder-field">
            <label htmlFor="embed-theme">{text.theme}</label>
            <select
              id="embed-theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as EmbedTheme)}
            >
              <option value="gold">{text.themes.gold}</option>
              <option value="light">{text.themes.light}</option>
            </select>
          </div>

          <div className="embed-builder-field">
            <label htmlFor="embed-view">{text.view}</label>
            <select
              id="embed-view"
              value={view}
              onChange={(event) => setView(event.target.value as EmbedView)}
            >
              <option value="full">{text.views.full}</option>
              <option value="lineage">{text.views.lineage}</option>
              <option value="compact">{text.views.compact}</option>
            </select>
          </div>
        </div>

        <div className="embed-builder-preview">
          <div>
            <small>{text.preview}</small>
            <strong>{personName}</strong>
          </div>
          <iframe
            key={previewSource}
            src={previewSource}
            title={`${text.preview}: ${personName}`}
          />
        </div>
      </section>

      <section className="embed-builder-code">
        <div>
          <small>{text.code}</small>
          <h2>{personName}</h2>
        </div>
        <pre><code>{code}</code></pre>
        <button type="button" onClick={copyCode}>
          {copied ? text.copied : text.copy}
        </button>
      </section>

      <section className="embed-builder-limits">
        <div>
          <small>01—04</small>
          <h2>{text.limitsTitle}</h2>
          <p>{text.note}</p>
        </div>
        <ol>
          {text.limits.map((limit, index) => (
            <li key={limit}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{limit}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}


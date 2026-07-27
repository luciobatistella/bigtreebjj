"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "./i18n/locale";

export type EditorialEntry = {
  id: string;
  name: string;
  epithet?: string;
  opening: string;
  formation?: string;
  activity?: string;
  descendants?: string;
  note?: string;
  gap?: string;
  research?: string;
  life?: string;
  location?: string;
  priority?: string;
  relationCount: number;
  sourceCount: number;
  conflictCount: number;
  exploreHref?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const archiveCopy = {
  pt: {
    search: "Buscar no acervo",
    placeholder: "Pessoa, equipe, cidade ou período...",
    gaps: "Lacunas abertas",
    result: (visible: number, total: number) => `${visible} de ${total} verbetes`,
    fallback: "",
    editorialEntry: "Verbete editorial",
    links: "vínculos",
    sources: "fontes",
    conflicts: "conflitos",
    formation: "Formação",
    activity: "Atuação",
    descendants: "Descendência e legado",
    note: "Nota da obra",
    gap: "Lacuna aberta",
    research: "Fila de apuração",
    openExplorer: "Abrir esta pessoa no Explorer →",
    consultSources: "Consultar fontes",
    empty: "Nenhum verbete corresponde a essa busca."
  },
  en: {
    search: "Search the archive",
    placeholder: "Person, team, city or period...",
    gaps: "Open gaps",
    result: (visible: number, total: number) => `${visible} of ${total} entries`,
    fallback: "",
    editorialEntry: "Editorial entry",
    links: "links",
    sources: "sources",
    conflicts: "conflicts",
    formation: "Training",
    activity: "Activity",
    descendants: "Descendants and legacy",
    note: "Editorial note",
    gap: "Open gap",
    research: "Research queue",
    openExplorer: "Open this person in the Explorer →",
    consultSources: "View sources",
    empty: "No entry matches this search."
  }
} as const;

export function EditorialArchive({
  entries,
  locale
}: {
  entries: EditorialEntry[];
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const [onlyWithGaps, setOnlyWithGaps] = useState(false);
  const copy = archiveCopy[locale];

  useEffect(() => {
    const openLinkedEntry = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!(target instanceof HTMLDetailsElement)) return;
      target.open = true;
      target.scrollIntoView({ block: "start" });
    };

    openLinkedEntry();
    window.addEventListener("hashchange", openLinkedEntry);
    return () => window.removeEventListener("hashchange", openLinkedEntry);
  }, []);

  const visibleEntries = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return entries.filter((entry) => {
      if (onlyWithGaps && !entry.gap) return false;
      if (!normalizedQuery) return true;
      return normalize(
        [
          entry.name,
          entry.epithet,
          entry.opening,
          entry.formation,
          entry.activity,
          entry.descendants,
          entry.location
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedQuery);
    });
  }, [entries, onlyWithGaps, query]);

  return (
    <div className="ed-archive">
      {copy.fallback ? <p className="ed-translation-notice">{copy.fallback}</p> : null}
      <div className="ed-archive-tools">
        <label className="ed-archive-search">
          <span>{copy.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
          />
        </label>
        <button
          type="button"
          className={onlyWithGaps ? "ed-filter ed-filter-active" : "ed-filter"}
          onClick={() => setOnlyWithGaps((value) => !value)}
          aria-pressed={onlyWithGaps}
        >
          {copy.gaps}
        </button>
        <span className="ed-result-count">
          {copy.result(visibleEntries.length, entries.length)}
        </span>
      </div>

      <div className="ed-entry-grid">
        {visibleEntries.map((entry, index) => (
          <details className="ed-entry" id={`verbete-${entry.id}`} key={entry.id}>
            <summary>
              <span className="ed-entry-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="ed-entry-title">
                <strong>{entry.name}</strong>
                <small>{entry.epithet || entry.life || entry.location || copy.editorialEntry}</small>
              </span>
              <span className="ed-entry-plus" aria-hidden="true">
                +
              </span>
            </summary>

            <div className="ed-entry-body">
              <p className="ed-entry-opening">{entry.opening}</p>

              <div className="ed-entry-meta">
                {entry.life ? <span>{entry.life}</span> : null}
                {entry.location ? <span>{entry.location}</span> : null}
                <span>{entry.relationCount} {copy.links}</span>
                <span>{entry.sourceCount} {copy.sources}</span>
                {entry.conflictCount ? <span>{entry.conflictCount} {copy.conflicts}</span> : null}
              </div>

              {entry.formation ? (
                <section>
                  <h3>{copy.formation}</h3>
                  <p>{entry.formation}</p>
                </section>
              ) : null}
              {entry.activity ? (
                <section>
                  <h3>{copy.activity}</h3>
                  <p>{entry.activity}</p>
                </section>
              ) : null}
              {entry.descendants ? (
                <section>
                  <h3>{copy.descendants}</h3>
                  <p>{entry.descendants}</p>
                </section>
              ) : null}
              {entry.note ? (
                <blockquote>
                  <strong>{copy.note}</strong>
                  {entry.note}
                </blockquote>
              ) : null}
              {entry.gap ? (
                <section className="ed-entry-gap">
                  <h3>{copy.gap}</h3>
                  <p>{entry.gap}</p>
                </section>
              ) : null}
              {entry.research ? (
                <section>
                  <h3>{copy.research}</h3>
                  <p>{entry.research}</p>
                </section>
              ) : null}

              <div className="ed-entry-actions">
                {entry.exploreHref ? (
                  <Link href={entry.exploreHref}>{copy.openExplorer}</Link>
                ) : null}
                <a href="#fontes">{copy.consultSources}</a>
              </div>
            </div>
          </details>
        ))}
      </div>

      {!visibleEntries.length ? (
        <p className="ed-empty">{copy.empty}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EmbedLocale,
  EmbedTheme,
  EmbedView,
  LineageEmbedPayload
} from "./embedTypes";

type Props = {
  slug: string;
  locale: EmbedLocale;
  theme: EmbedTheme;
  view: EmbedView;
};

const copy = {
  pt: {
    official: "Linhagem oficial",
    maintained: "Registro mantido por The Big Tree BJJ",
    generation: (value: number) => `${value}ª geração`,
    lineage: "A linhagem",
    origin: "Do primeiro elo registrado até aqui",
    directBlackBelts: "A árvore continua",
    students: (total: number) =>
      total === 1 ? "1 faixa-preta diretamente conectado" : `${total} faixas-pretas diretamente conectados`,
    more: (total: number) => `+${total} conexões disponíveis na árvore completa`,
    open: "Abrir árvore oficial",
    loading: "Carregando linhagem oficial…",
    errorTitle: "Linhagem indisponível",
    retry: "Tentar novamente",
    photo: "Crédito e licença da fotografia",
    final: "Você está aqui"
  },
  en: {
    official: "Official lineage",
    maintained: "Record maintained by The Big Tree BJJ",
    generation: (value: number) => `${value}${ordinal(value)} generation`,
    lineage: "The lineage",
    origin: "From the first recorded link to this point",
    directBlackBelts: "The tree continues",
    students: (total: number) =>
      total === 1 ? "1 directly connected black belt" : `${total} directly connected black belts`,
    more: (total: number) => `+${total} connections available in the complete tree`,
    open: "Open official tree",
    loading: "Loading official lineage…",
    errorTitle: "Lineage unavailable",
    retry: "Try again",
    photo: "Photo credit and license",
    final: "You are here"
  }
} as const;

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TBT"
  );
}

export function LineageEmbed({ slug, locale, theme, view }: Props) {
  const [payload, setPayload] = useState<LineageEmbedPayload | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const text = copy[locale];

  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setError("");

    fetch(`/api/embed/${encodeURIComponent(slug)}?locale=${locale}`, {
      signal: controller.signal,
      credentials: "omit"
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as
          | LineageEmbedPayload
          | { error?: string };
        if (!response.ok || !("person" in body)) {
          throw new Error("error" in body ? body.error : text.errorTitle);
        }
        setPayload(body);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : text.errorTitle);
      });

    return () => controller.abort();
  }, [locale, reloadKey, slug, text.errorTitle]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.parent === window) return;

    const reportSize = () => {
      window.parent.postMessage(
        {
          type: "tbt:embed:resize",
          slug,
          height: Math.ceil(root.getBoundingClientRect().height)
        },
        "*"
      );
    };
    const observer = new ResizeObserver(reportSize);
    observer.observe(root);
    reportSize();
    return () => observer.disconnect();
  }, [payload, slug, view]);

  const hiddenStudents = useMemo(() => {
    if (!payload) return 0;
    return Math.max(0, payload.directBlackBelts.total - payload.directBlackBelts.shown);
  }, [payload]);

  return (
    <main
      ref={rootRef}
      className={`tbt-embed tbt-embed-${theme} tbt-embed-${view}`}
      data-testid="lineage-embed"
    >
      <div className="tbt-embed-sky" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>

      <header className="tbt-embed-brand">
        <a href="/" target="_blank" rel="noopener noreferrer" aria-label="The Big Tree BJJ">
          <img src="/logo-embed.webp" alt="" width="52" height="52" />
          <span>
            <b>The Big Tree BJJ</b>
            <small>{text.maintained}</small>
          </span>
        </a>
        <em><i aria-hidden="true" /> {text.official}</em>
      </header>

      {!payload && !error ? (
        <section className="tbt-embed-state" aria-live="polite">
          <span className="tbt-embed-loader" aria-hidden="true" />
          <p>{text.loading}</p>
        </section>
      ) : null}

      {error ? (
        <section className="tbt-embed-state tbt-embed-error" role="alert">
          <strong>{text.errorTitle}</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            {text.retry}
          </button>
        </section>
      ) : null}

      {payload ? (
        <>
          <section className="tbt-embed-hero">
            <div className="tbt-embed-portrait">
              {payload.person.portrait ? (
                <>
                  <img
                    src={payload.person.portrait.src}
                    alt={payload.person.name}
                    style={{ objectPosition: payload.person.portrait.objectPosition }}
                  />
                  <a
                    href={payload.person.portrait.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${payload.person.portrait.attribution} · ${payload.person.portrait.license}`}
                    aria-label={text.photo}
                  >
                    i
                  </a>
                </>
              ) : (
                <span>{initials(payload.person.name)}</span>
              )}
            </div>
            <div className="tbt-embed-identity">
              <small>{text.official}</small>
              <h1>{payload.person.name}</h1>
              {payload.person.team ? <p>{payload.person.team}</p> : null}
            </div>
            <div className="tbt-embed-generation" aria-label={text.generation(payload.generation)}>
              <i aria-hidden="true">✦</i>
              <strong>{String(payload.generation).padStart(2, "0")}</strong>
              <small>{text.generation(payload.generation)}</small>
            </div>
          </section>

          <section className="tbt-embed-lineage-section">
            <div className="tbt-embed-section-title">
              <small>{text.lineage}</small>
              <p>{text.origin}</p>
            </div>
            <ol className="tbt-embed-lineage">
              {payload.lineage.map((person, index) => {
                const isFinal = index === payload.lineage.length - 1;
                return (
                  <li key={`${person.slug}-${index}`} className={isFinal ? "is-final" : ""}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{initials(person.name)}</b>
                    <strong>{person.name}</strong>
                    <small>{isFinal ? text.final : person.relationLabel}</small>
                  </li>
                );
              })}
            </ol>
          </section>

          {view === "full" && payload.directBlackBelts.total > 0 ? (
            <section className="tbt-embed-descendants">
              <div className="tbt-embed-section-title">
                <small>{text.directBlackBelts}</small>
                <p>{text.students(payload.directBlackBelts.total)}</p>
              </div>
              <div className="tbt-embed-student-grid">
                {payload.directBlackBelts.items.map((student) => (
                  <a
                    key={student.slug}
                    href={`/in/${student.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>{initials(student.name)}</span>
                    <strong>{student.name}</strong>
                    <i aria-hidden="true">↗</i>
                  </a>
                ))}
              </div>
              {hiddenStudents ? <p>{text.more(hiddenStudents)}</p> : null}
            </section>
          ) : null}

          <footer className="tbt-embed-footer">
            <p>
              <span aria-hidden="true">✦</span>
              {text.maintained}
            </p>
            <a
              href={payload.canonicalPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              {text.open} <span aria-hidden="true">↗</span>
            </a>
          </footer>
        </>
      ) : null}
    </main>
  );
}


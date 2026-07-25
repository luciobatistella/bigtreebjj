"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Locale } from "../../i18n/locale";

type SubmissionStatus = {
  protocol: string;
  status: "pending_review" | "needs_evidence" | "approved" | "rejected";
  fullName: string;
  teacherName: string;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewerMessage?: string | null;
};

const pageCopy = {
  pt: {
    statuses: {
      pending_review: {
        label: "Em revisão",
        title: "Sua conexão está na fila editorial.",
        description:
          "Vamos conferir a pessoa, o vínculo informado e as evidências antes de publicar.",
        step: 2
      },
      needs_evidence: {
        label: "Mais evidências",
        title: "Precisamos de mais contexto.",
        description:
          "A revisão foi pausada até recebermos informações que ajudem a confirmar o vínculo.",
        step: 2
      },
      approved: {
        label: "Aprovada",
        title: "Sua conexão entrou para a árvore.",
        description:
          "A revisão foi concluída e o vínculo já pode fazer parte do Explorer.",
        step: 3
      },
      rejected: {
        label: "Não aprovada",
        title: "Não foi possível publicar esta conexão.",
        description:
          "A equipe editorial concluiu a análise sem evidência suficiente para inclusão.",
        step: 2
      }
    },
    missing: "Informe o protocolo recebido no envio.",
    notFound: "Protocolo não encontrado.",
    lookupError: "Não foi possível consultar o protocolo.",
    eyebrow: "Protocolo de linhagem",
    title: "Acompanhe sua conexão.",
    lede:
      "A árvore não cresce no escuro. Cada novo nome passa pela mesma conferência editorial.",
    protocol: "Seu protocolo",
    loading: "Consultando…",
    lookup: "Consultar",
    name: "Nome",
    connection: "Conexão informada",
    received: "Recebida em",
    progressLabel: "Etapas da solicitação",
    progress: ["Enviada", "Revisão editorial", "Publicada"],
    curator: "Mensagem da curadoria",
    openExplorer: "Abrir Explorer",
    resubmit: "Enviar nova solicitação",
    back: "Voltar à home"
  },
  en: {
    statuses: {
      pending_review: {
        label: "Under review",
        title: "Your connection is in the editorial queue.",
        description:
          "We will verify the person, the reported relationship and the evidence before publishing.",
        step: 2
      },
      needs_evidence: {
        label: "More evidence needed",
        title: "We need more context.",
        description:
          "Review is paused until we receive information that helps confirm the relationship.",
        step: 2
      },
      approved: {
        label: "Approved",
        title: "Your connection has joined the tree.",
        description:
          "Review is complete and the relationship can now appear in the Explorer.",
        step: 3
      },
      rejected: {
        label: "Not approved",
        title: "This connection could not be published.",
        description:
          "The editorial team completed its review without enough evidence for inclusion.",
        step: 2
      }
    },
    missing: "Enter the tracking code you received after submission.",
    notFound: "Tracking code not found.",
    lookupError: "We could not look up this tracking code.",
    eyebrow: "Lineage tracking code",
    title: "Track your connection.",
    lede:
      "The tree does not grow in the dark. Every new name goes through the same editorial review.",
    protocol: "Your tracking code",
    loading: "Checking…",
    lookup: "Check status",
    name: "Name",
    connection: "Reported connection",
    received: "Received on",
    progressLabel: "Request stages",
    progress: ["Submitted", "Editorial review", "Published"],
    curator: "Editorial message",
    openExplorer: "Open Explorer",
    resubmit: "Submit a new request",
    back: "Back to home"
  }
} as const;

export function StatusLookup({
  initialProtocol,
  locale
}: {
  initialProtocol: string;
  locale: Locale;
}) {
  const page = pageCopy[locale];
  const [protocol, setProtocol] = useState(initialProtocol);
  const [result, setResult] = useState<SubmissionStatus | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "found" | "error">(
    initialProtocol ? "loading" : "idle"
  );
  const [message, setMessage] = useState("");

  const lookup = async (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      setState("error");
      setMessage(page.missing);
      return;
    }
    setState("loading");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch(`/api/join/status/${encodeURIComponent(normalized)}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(page.notFound);
      setProtocol(normalized);
      setResult(payload as SubmissionStatus);
      setState("found");
      window.history.replaceState(null, "", `/join/status?protocol=${encodeURIComponent(normalized)}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : page.lookupError);
    }
  };

  useEffect(() => {
    if (initialProtocol) void lookup(initialProtocol);
    // Consulta automática apenas ao abrir a página com um protocolo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProtocol]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void lookup(protocol);
  };

  const copy = result ? page.statuses[result.status] ?? page.statuses.pending_review : null;

  return (
    <section className="status-shell">
      <div className="status-intro">
        <p>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <span>{page.lede}</span>
      </div>

      <form className="status-search" onSubmit={submit}>
        <label htmlFor="status-protocol">{page.protocol}</label>
        <div>
          <input
            id="status-protocol"
            value={protocol}
            onChange={(event) => setProtocol(event.target.value.toUpperCase())}
            placeholder="TBT-2026-XXXXXXXX"
            autoComplete="off"
          />
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? page.loading : page.lookup}
          </button>
        </div>
        {state === "error" ? <small role="alert">{message}</small> : null}
      </form>

      {result && copy ? (
        <article className={`status-card status-${result.status}`} aria-live="polite">
          <div className="status-card-top">
            <span>{copy.label}</span>
            <small>{result.protocol}</small>
          </div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>

          <dl>
            <div>
              <dt>{page.name}</dt>
              <dd>{result.fullName}</dd>
            </div>
            <div>
              <dt>{page.connection}</dt>
              <dd>{result.teacherName}</dd>
            </div>
            <div>
              <dt>{page.received}</dt>
              <dd>
                {new Date(result.submittedAt).toLocaleDateString(
                  locale === "en" ? "en-US" : "pt-BR"
                )}
              </dd>
            </div>
          </dl>

          <ol className="status-progress" aria-label={page.progressLabel}>
            {page.progress.map((label, index) => (
              <li key={label} className={index + 1 <= copy.step ? "is-active" : ""}>
                <i>{index + 1}</i>
                <span>{label}</span>
              </li>
            ))}
          </ol>

          {result.reviewerMessage ? (
            <div className="status-note">
              <small>{page.curator}</small>
              <p>{result.reviewerMessage}</p>
            </div>
          ) : null}

          <div className="status-actions">
            {result.status === "approved" ? (
              <Link href="/explore">{page.openExplorer}</Link>
            ) : null}
            {result.status === "needs_evidence" ? (
              <Link href={`/join?teacher=${encodeURIComponent(result.teacherName)}`}>
                {page.resubmit}
              </Link>
            ) : null}
            <Link href="/">{page.back}</Link>
          </div>
        </article>
      ) : null}
    </section>
  );
}

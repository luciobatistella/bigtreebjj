"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../lib/adminApi";

type QueueKind = "submissions" | "claims";

type Submission = {
  id: string;
  protocol: string;
  fullName: string;
  teacherName: string;
  teacherNames?: string[];
  academyTeam?: string | null;
  city?: string | null;
  country?: string | null;
  evidenceUrls?: string[];
  hasCertificate?: boolean;
  certificateCount?: number;
  status: string;
  createdAt: string;
};

type Claim = {
  id: string;
  student: string;
  teacher: string;
  claimType: string;
  relationshipLabel?: string | null;
  evidenceLevel?: string | null;
  confidenceScore?: number | null;
  sourceCount: number;
  status: string;
  updatedAt: string;
};

const filtersByKind = {
  submissions: [
    ["pending_review", "Pendentes"],
    ["needs_evidence", "Mais evidências"],
    ["approved", "Aprovadas"],
    ["rejected", "Recusadas"],
    ["all", "Todas"]
  ],
  claims: [
    ["pending_review", "Pendentes"],
    ["needs_evidence", "Mais evidências"],
    ["confirmed", "Confirmadas"],
    ["disputed", "Contestadas"],
    ["rejected", "Recusadas"],
    ["all", "Todas"]
  ]
} as const;

const statusLabel: Record<string, string> = {
  pending_review: "Pendente",
  needs_evidence: "Mais evidências",
  approved: "Aprovada",
  confirmed: "Confirmada",
  corroborated: "Corroborada",
  disputed: "Contestada",
  rejected: "Recusada"
};

function statusClass(status: string) {
  if (["approved", "confirmed", "corroborated"].includes(status)) return "is-approved";
  if (status === "rejected" || status === "disputed") return "is-rejected";
  return "is-pending";
}

export default function ReviewAdminPage() {
  const [kind, setKind] = useState<QueueKind>("submissions");
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState<Array<Submission | Claim>>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setMessage("");

    adminApiFetch(`/review/${kind}?status=${encodeURIComponent(status)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a fila.");
        const payload = await response.json();
        setItems(Array.isArray(payload) ? payload : []);
        setState("ready");
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
        setMessage(cause instanceof Error ? cause.message : "Falha ao carregar a fila.");
        setState("error");
      });

    return () => controller.abort();
  }, [kind, status]);

  const description = useMemo(
    () =>
      kind === "submissions"
        ? "Pedidos enviados pelo público, com dados de contato e certificados protegidos."
        : "Relações vindas de importações e pesquisa que ainda precisam de uma decisão editorial.",
    [kind]
  );

  const changeKind = (nextKind: QueueKind) => {
    setKind(nextKind);
    setStatus("pending_review");
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <div className="admin-eyebrow">Curadoria</div>
          <h1 className="admin-page-title">Fila de aprovação</h1>
          <p className="admin-page-lead">{description}</p>
        </div>
        <span className="admin-live-badge">Privado</span>
      </header>

      <nav className="admin-kind-switch" aria-label="Tipo de material">
        <button
          type="button"
          className={kind === "submissions" ? "is-active" : ""}
          onClick={() => changeKind("submissions")}
        >
          <span>01</span>
          <strong>Autocadastros</strong>
          <small>Solicitações de faixas-pretas</small>
        </button>
        <button
          type="button"
          className={kind === "claims" ? "is-active" : ""}
          onClick={() => changeKind("claims")}
        >
          <span>02</span>
          <strong>Relações importadas</strong>
          <small>Pesquisa e conexões históricas</small>
        </button>
      </nav>

      <nav className="admin-tabs admin-section-gap" aria-label="Status da fila">
        {filtersByKind[kind].map(([value, label]) => (
          <button
            type="button"
            className={`admin-tab ${status === value ? "is-active" : ""}`}
            key={value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="admin-panel">
        <header className="admin-panel-head">
          <h2>{kind === "submissions" ? "Pessoas que querem entrar na árvore" : "Conexões para validar"}</h2>
          <small>{state === "ready" ? `${items.length} registros` : "atualizando"}</small>
        </header>

        {state === "loading" ? (
          <div className="admin-empty admin-loading"><strong>Carregando a fila…</strong>Consultando o acervo protegido.</div>
        ) : null}
        {state === "error" ? (
          <div className="admin-empty"><strong>Não foi possível carregar</strong>{message}</div>
        ) : null}
        {state === "ready" && items.length === 0 ? (
          <div className="admin-empty"><strong>Fila limpa</strong>Nenhum registro corresponde a este filtro.</div>
        ) : null}

        {state === "ready" ? (
          <div className="admin-queue">
            {kind === "submissions"
              ? (items as Submission[]).map((submission) => {
                  const teachers = submission.teacherNames?.length
                    ? submission.teacherNames
                    : [submission.teacherName];
                  return (
                    <article className="admin-queue-card" key={submission.id}>
                      <div>
                        <strong>{submission.fullName}</strong>
                        <small>{submission.protocol}</small>
                      </div>
                      <div className="admin-queue-meta">
                        <span>Professor: {teachers.filter(Boolean).join(" + ") || "não informado"}</span>
                        <small>
                          {[submission.academyTeam, submission.city, submission.country]
                            .filter(Boolean)
                            .join(" · ") || "Local não informado"}
                          {submission.hasCertificate
                            ? ` · ${submission.certificateCount ?? 1} certificado(s)`
                            : ""}
                        </small>
                      </div>
                      <div>
                        <span className={`admin-status-badge ${statusClass(submission.status)}`}>
                          {statusLabel[submission.status] ?? submission.status}
                        </span>
                        <small>{new Date(submission.createdAt).toLocaleDateString("pt-BR")}</small>
                      </div>
                      <Link className="admin-button-secondary" href={`/admin/review/submissions/${submission.id}`}>
                        Revisar
                      </Link>
                    </article>
                  );
                })
              : (items as Claim[]).map((claim) => (
                  <article className="admin-queue-card" key={claim.id}>
                    <div>
                      <strong>{claim.student}</strong>
                      <small>{claim.claimType.replaceAll("_", " ")}</small>
                    </div>
                    <div className="admin-queue-meta">
                      <span>Professor: {claim.teacher}</span>
                      <small>{claim.sourceCount} fonte(s) · evidência {claim.evidenceLevel ?? "não classificada"}</small>
                    </div>
                    <div>
                      <span className={`admin-status-badge ${statusClass(claim.status)}`}>
                        {statusLabel[claim.status] ?? claim.status}
                      </span>
                      <small>{new Date(claim.updatedAt).toLocaleDateString("pt-BR")}</small>
                    </div>
                    <Link className="admin-button-secondary" href={`/admin/review/claims/${claim.id}`}>
                      Revisar
                    </Link>
                  </article>
                ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

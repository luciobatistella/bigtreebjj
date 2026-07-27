"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../../lib/adminApi";

type Certificate = {
  id: string;
  track: "adult" | "youth";
  beltRank: string;
  beltLabel: string;
  sequence: number;
  awardedAt?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
};

type Submission = {
  id: string;
  protocol: string;
  fullName: string;
  email: string;
  instagram?: string | null;
  teacherPersonId?: string | null;
  teacherName: string;
  teacherPersonIds?: string[];
  teacherNames?: string[];
  academyTeam?: string | null;
  city?: string | null;
  country?: string | null;
  promotionDate?: string | null;
  claimType: string;
  graduationTrack?: "adult" | "youth" | null;
  certificateCompletenessConfirmed?: boolean;
  evidenceUrls: string[];
  evidenceNotes?: string | null;
  hasCertificate?: boolean;
  certificateOriginalName?: string | null;
  certificateMimeType?: string | null;
  certificateSize?: number | null;
  certificateSha256?: string | null;
  certificateCount?: number;
  certificates?: Certificate[];
  status: string;
  personId?: string | null;
  lineageClaimId?: string | null;
  reviewerNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

const claimLabels: Record<string, string> = {
  black_belt_awarded_by: "Faixa-preta concedida por",
  co_awarded_black_belt: "Faixa-preta concedida em conjunto por",
  trained_under: "Treinou sob"
};

const statusLabels: Record<string, string> = {
  pending_review: "Pendente",
  needs_evidence: "Mais evidências",
  approved: "Aprovada",
  rejected: "Recusada"
};

export default function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");
  const [certificateState, setCertificateState] = useState<"idle" | "loading">("idle");

  const load = useCallback(async () => {
    try {
      setState("loading");
      const response = await adminApiFetch(`/review/submissions/${params.id}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Solicitação não encontrada.");
      setSubmission(payload as Submission);
      setNotes((payload as Submission).reviewerNotes ?? "");
      setState("ready");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
      setMessage(cause instanceof Error ? cause.message : "Falha ao carregar.");
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const teacherNames = useMemo(
    () =>
      submission?.teacherNames?.length
        ? submission.teacherNames
        : submission?.teacherName
          ? [submission.teacherName]
          : [],
    [submission]
  );

  const teachersLabel = useMemo(
    () =>
      teacherNames.length
        ? new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(teacherNames)
        : "Professor não informado",
    [teacherNames]
  );

  const decide = async (action: "approve" | "reject" | "request_evidence") => {
    if (!submission) return;
    if (action !== "approve" && notes.trim().length < 8) {
      setMessage("Escreva uma orientação clara para o solicitante antes desta decisão.");
      return;
    }
    if (
      action === "approve" &&
      !window.confirm(
        `Aprovar ${submission.fullName} como conexão de ${teachersLabel}? ${teacherNames.length} vínculo(s) confirmado(s) serão publicados.`
      )
    ) return;

    try {
      setState("saving");
      setMessage("");
      const response = await adminApiFetch(`/review/submissions/${submission.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          reviewerNotes: notes.trim(),
          teacherPersonId: submission.teacherPersonId || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a decisão.");
      setMessage(
        action === "approve"
          ? "Solicitação aprovada e publicada na árvore."
          : action === "reject"
            ? "Solicitação recusada."
            : "O solicitante foi marcado como aguardando mais evidências."
      );
      await load();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
      setState("ready");
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a decisão.");
    }
  };

  const downloadCertificate = async (certificateId?: string, originalName?: string) => {
    if (!submission?.hasCertificate) return;
    setCertificateState("loading");
    try {
      const path = certificateId
        ? `/review/submissions/${submission.id}/certificates/${certificateId}`
        : `/review/submissions/${submission.id}/certificate`;
      const response = await adminApiFetch(path);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Não foi possível baixar o certificado.");
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = originalName || submission.certificateOriginalName || "certificado";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
      setMessage(cause instanceof Error ? cause.message : "Não foi possível baixar o certificado.");
    } finally {
      setCertificateState("idle");
    }
  };

  if (!submission) {
    return (
      <main className="admin-page">
        <Link className="admin-back-link" href="/admin/review">← Voltar para a fila</Link>
        <section className="admin-panel admin-empty">
          <strong>{state === "error" ? "Não foi possível abrir" : "Carregando solicitação…"}</strong>
          {message || "Consultando dados privados e certificados."}
        </section>
      </main>
    );
  }

  const teacherIds = submission.teacherPersonIds?.length
    ? submission.teacherPersonIds
    : submission.teacherPersonId
      ? [submission.teacherPersonId]
      : [];
  const isPending = ["pending_review", "needs_evidence"].includes(submission.status);
  const certificates = submission.certificates ?? [];

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/review">← Voltar para a fila</Link>
          <div className="admin-eyebrow">{submission.protocol}</div>
          <h1 className="admin-page-title">{submission.fullName}</h1>
          <p className="admin-page-lead">
            {claimLabels[submission.claimType] ?? submission.claimType} <strong>{teachersLabel}</strong>.
          </p>
        </div>
        <span className={`admin-status-badge ${submission.status === "approved" ? "is-approved" : submission.status === "rejected" ? "is-rejected" : "is-pending"}`}>
          {statusLabels[submission.status] ?? submission.status}
        </span>
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <div className="admin-detail-grid">
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Conexão declarada</h2><small>{teacherNames.length} professor(es)</small></header>
          <div className="admin-panel-body">
            <div className="admin-relationship">
              <div><small>Solicitante</small><strong>{submission.fullName}</strong></div>
              <span aria-hidden="true">→</span>
              <div><small>Professor(es)</small><strong>{teachersLabel}</strong></div>
            </div>
            <dl className="admin-definition-grid admin-section-gap">
              <div><dt>IDs dos professores</dt><dd>{teacherIds.join(", ") || "Não resolvidos"}</dd></div>
              <div><dt>Data da graduação</dt><dd>{submission.promotionDate ? new Date(submission.promotionDate).toLocaleDateString("pt-BR") : "Não informada"}</dd></div>
              <div><dt>Percurso</dt><dd>{submission.graduationTrack === "youth" ? "Início juvenil" : "Início adulto"}</dd></div>
              <div><dt>Documentação completa</dt><dd>{submission.certificateCompletenessConfirmed ? "Declarada pelo solicitante" : "Não confirmada"}</dd></div>
              <div><dt>Equipe</dt><dd>{submission.academyTeam ?? "Não informada"}</dd></div>
              <div><dt>Local</dt><dd>{[submission.city, submission.country].filter(Boolean).join(", ") || "Não informado"}</dd></div>
              <div><dt>Recebida</dt><dd>{new Date(submission.createdAt).toLocaleString("pt-BR")}</dd></div>
              <div><dt>Vínculo publicado</dt><dd>{submission.lineageClaimId ?? "Ainda não"}</dd></div>
            </dl>
          </div>
        </section>

        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Contato privado</h2><small>Não publicar</small></header>
          <div className="admin-panel-body admin-source-list">
            <a className="admin-link-card" href={`mailto:${submission.email}`}>
              <small>E-mail</small><strong>{submission.email}</strong>
            </a>
            {submission.instagram ? (
              <div className="admin-link-card"><small>Instagram</small><strong>{submission.instagram}</strong></div>
            ) : null}
            <div className="admin-privacy-note">
              Estes dados servem apenas para validação e contato editorial.
            </div>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-section-gap">
        <header className="admin-panel-head"><h2>Certificados</h2><small>{submission.certificateCount ?? certificates.length} arquivos privados</small></header>
        <div className="admin-certificate-grid">
          {certificates.map((certificate, index) => (
            <article className="admin-certificate-card" key={certificate.id}>
              <div className="admin-certificate-rank">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <small>{certificate.track === "youth" ? "Percurso juvenil" : "Percurso adulto"}</small>
                <strong>{certificate.beltLabel}</strong>
                <p>{certificate.originalName}</p>
                <code>{(certificate.size / 1024 / 1024).toFixed(2)} MB · SHA-256 {certificate.sha256.slice(0, 12)}…</code>
              </div>
              <button
                className="admin-button-secondary"
                type="button"
                disabled={certificateState === "loading"}
                onClick={() => void downloadCertificate(certificate.id, certificate.originalName)}
              >
                Abrir
              </button>
            </article>
          ))}
          {!certificates.length && submission.hasCertificate ? (
            <article className="admin-certificate-card">
              <div className="admin-certificate-rank">01</div>
              <div>
                <small>Pré-evidência privada</small>
                <strong>Certificado enviado</strong>
                <p>{submission.certificateOriginalName}</p>
                <code>{submission.certificateMimeType} · {submission.certificateSize ? `${(submission.certificateSize / 1024 / 1024).toFixed(2)} MB` : ""}</code>
              </div>
              <button
                className="admin-button-secondary"
                type="button"
                disabled={certificateState === "loading"}
                onClick={() => void downloadCertificate(undefined, submission.certificateOriginalName ?? undefined)}
              >
                Abrir
              </button>
            </article>
          ) : null}
          {!submission.hasCertificate ? (
            <div className="admin-empty"><strong>Nenhum certificado</strong>Não há documentos privados anexados.</div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel admin-section-gap">
        <header className="admin-panel-head"><h2>Outras evidências</h2><small>{submission.evidenceUrls.length} links</small></header>
        <div className="admin-panel-body admin-source-list">
          {submission.evidenceNotes ? <p className="admin-evidence-note">{submission.evidenceNotes}</p> : null}
          {submission.evidenceUrls.map((url) => (
            <a className="admin-link-card" href={url} target="_blank" rel="noreferrer" key={url}>
              <small>Link enviado</small><strong>{url}</strong>
            </a>
          ))}
          {!submission.evidenceUrls.length && !submission.evidenceNotes ? (
            <div className="admin-empty"><strong>Sem evidências adicionais</strong>Confira os certificados acima.</div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel admin-section-gap">
        <header className="admin-panel-head"><h2>Parecer editorial</h2><small>Visível na consulta do protocolo</small></header>
        <div className="admin-panel-body">
          <label className="admin-field">
            Mensagem e notas da revisão
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Explique o que foi conferido ou qual evidência ainda é necessária."
            />
          </label>
        </div>
      </section>

      <div className="admin-decision-bar">
        <small>{isPending ? "A aprovação publica a pessoa e suas conexões na árvore." : "Esta solicitação já recebeu uma decisão."}</small>
        <div className="admin-decision-actions">
          <button className="admin-button" disabled={!isPending || state === "saving"} onClick={() => void decide("approve")}>Aprovar e publicar</button>
          <button className="admin-button-warning" disabled={!isPending || state === "saving"} onClick={() => void decide("request_evidence")}>Pedir evidências</button>
          <button className="admin-button-danger" disabled={!isPending || state === "saving"} onClick={() => void decide("reject")}>Recusar</button>
        </div>
      </div>
    </main>
  );
}

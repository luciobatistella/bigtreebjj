"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../../lib/adminApi";

type ClaimReview = {
  id: string;
  student: string;
  teacher: string;
  claimType: string;
  relationshipLabel?: string | null;
  promotionGroup?: string | null;
  evidenceLevel?: string | null;
  status: string;
  importedSourceRow?: number | null;
  linkedSources?: Array<{ id?: string; url?: string; sourceType?: string }>;
  evidenceUrls?: string[];
  internalNotes?: string;
  auditHistory?: Array<{ id?: string; action?: string; notes?: string; createdAt?: string }>;
};

const statusLabel: Record<string, string> = {
  pending_review: "Pendente",
  needs_evidence: "Mais evidências",
  confirmed: "Confirmada",
  corroborated: "Corroborada",
  disputed: "Contestada",
  rejected: "Recusada"
};

export default function ClaimReviewPage({ params }: { params: { id: string } }) {
  const [claim, setClaim] = useState<ClaimReview | null>(null);
  const [note, setNote] = useState("");
  const [evidenceLevel, setEvidenceLevel] = useState("imported");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setState("loading");
      const response = await adminApiFetch(`/review/claims/${params.id}`);
      if (!response.ok) throw new Error(response.status === 404 ? "Relação não encontrada." : "Não foi possível carregar a relação.");
      const payload = (await response.json()) as ClaimReview;
      setClaim(payload);
      setEvidenceLevel(payload.evidenceLevel ?? "imported");
      setNote(payload.internalNotes ?? "");
      setState("ready");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
      setMessage(cause instanceof Error ? cause.message : "Falha ao carregar a relação.");
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (action: "approve" | "reject" | "dispute" | "request-evidence") => {
    if (["reject", "dispute", "request-evidence"].includes(action) && !note.trim()) {
      setMessage("Explique a decisão nas notas antes de continuar.");
      return;
    }
    if (
      action === "approve" &&
      claim?.claimType === "black_belt_awarded_by" &&
      !window.confirm(`Confirmar que ${claim.student} recebeu a faixa-preta de ${claim.teacher}?`)
    ) return;

    setState("saving");
    setMessage("");
    try {
      const response = await adminApiFetch(`/review/claims/${params.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ notes: note.trim(), evidenceLevel })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? payload.error ?? "Não foi possível salvar a decisão.");
      }
      setMessage("Decisão registrada com sucesso.");
      await load();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
      setState("ready");
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    }
  };

  const sourceLinks = (claim?.linkedSources ?? [])
    .map((source) => ({ url: source.url, label: source.sourceType ?? "Fonte vinculada" }))
    .filter((source): source is { url: string; label: string } => Boolean(source.url));

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/review">← Voltar para a fila</Link>
          <div className="admin-eyebrow">Revisão de linhagem</div>
          <h1 className="admin-page-title">{claim?.student ?? "Carregando relação…"}</h1>
          <p className="admin-page-lead">
            {claim ? <>Faixa-preta atribuída por <strong>{claim.teacher}</strong>.</> : "Consultando o registro editorial."}
          </p>
        </div>
        {claim ? <span className="admin-status-badge is-pending">{statusLabel[claim.status] ?? claim.status}</span> : null}
      </header>

      {message ? <div className={`admin-alert ${state === "error" ? "is-danger" : ""}`} role="status">{message}</div> : null}

      {state === "loading" && !claim ? (
        <section className="admin-panel admin-empty"><strong>Carregando relação…</strong>Acessando fontes e histórico.</section>
      ) : null}

      {claim ? (
        <>
          <div className="admin-detail-grid">
            <section className="admin-panel">
              <header className="admin-panel-head"><h2>Conexão proposta</h2><small>Dados estruturados</small></header>
              <div className="admin-panel-body">
                <div className="admin-relationship">
                  <div><small>Aluno</small><strong>{claim.student}</strong></div>
                  <span aria-hidden="true">→</span>
                  <div><small>Professor</small><strong>{claim.teacher}</strong></div>
                </div>
                <dl className="admin-definition-grid admin-section-gap">
                  <div><dt>Tipo da relação</dt><dd>{claim.claimType.replaceAll("_", " ")}</dd></div>
                  <div><dt>Nível de evidência</dt><dd>{claim.evidenceLevel ?? "Não classificado"}</dd></div>
                  <div><dt>Grupo de graduação</dt><dd>{claim.promotionGroup ?? "Individual"}</dd></div>
                  <div><dt>Linha importada</dt><dd>{claim.importedSourceRow ?? "Não disponível"}</dd></div>
                </dl>
              </div>
            </section>

            <section className="admin-panel">
              <header className="admin-panel-head"><h2>Fontes e evidências</h2><small>{sourceLinks.length} links</small></header>
              <div className="admin-panel-body admin-source-list">
                {sourceLinks.map((source, index) => (
                  <a className="admin-link-card" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}>
                    <small>{source.label}</small>
                    <strong>{source.url}</strong>
                  </a>
                ))}
                {!sourceLinks.length ? (
                  <div className="admin-empty"><strong>Nenhuma fonte vinculada</strong>Solicite evidências antes de aprovar.</div>
                ) : null}
              </div>
            </section>
          </div>

          <section className="admin-panel admin-section-gap">
            <header className="admin-panel-head"><h2>Parecer editorial</h2><small>Registrado na auditoria</small></header>
            <div className="admin-panel-body admin-review-form">
              <label className="admin-field">
                Nível da evidência
                <select value={evidenceLevel} onChange={(event) => setEvidenceLevel(event.target.value)}>
                  <option value="imported">Importada</option>
                  <option value="community_submission">Envio da comunidade</option>
                  <option value="primary_source">Fonte primária</option>
                  <option value="official_record">Registro oficial</option>
                </select>
              </label>
              <label className="admin-field">
                Notas internas
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Registre o raciocínio, as ressalvas e o que foi conferido."
                />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-section-gap">
            <header className="admin-panel-head"><h2>Histórico</h2><small>{claim.auditHistory?.length ?? 0} eventos</small></header>
            <div className="admin-timeline">
              {(claim.auditHistory ?? []).map((entry, index) => (
                <article key={entry.id ?? `${entry.action}-${index}`}>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{entry.action?.replaceAll("_", " ") ?? "Alteração"}</strong>
                    <p>{entry.notes || "Sem observação registrada."}</p>
                    <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("pt-BR") : ""}</small>
                  </div>
                </article>
              ))}
              {!claim.auditHistory?.length ? <div className="admin-empty">Nenhuma decisão anterior.</div> : null}
            </div>
          </section>

          <div className="admin-decision-bar">
            <small>Esta decisão altera o que pode aparecer publicamente na árvore.</small>
            <div className="admin-decision-actions">
              <button className="admin-button" disabled={state === "saving"} onClick={() => void decide("approve")}>Aprovar relação</button>
              <button className="admin-button-warning" disabled={state === "saving"} onClick={() => void decide("request-evidence")}>Pedir evidências</button>
              <button className="admin-button-secondary" disabled={state === "saving"} onClick={() => void decide("dispute")}>Contestar</button>
              <button className="admin-button-danger" disabled={state === "saving"} onClick={() => void decide("reject")}>Recusar</button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

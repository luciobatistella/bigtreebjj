"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../../lib/adminApi";

function value(person: any, ...keys: string[]) {
  for (const key of keys) {
    const candidate = person?.[key];
    if (Array.isArray(candidate)) return candidate.join(", ") || "Não informado";
    if (candidate !== undefined && candidate !== null && candidate !== "") return String(candidate);
  }
  return "Não informado";
}

function PersonPanel({ title, person, tone }: { title: string; person: any; tone: "incoming" | "existing" }) {
  return (
    <section className={`admin-panel admin-person-panel is-${tone}`}>
      <header className="admin-panel-head"><h2>{title}</h2><small>{tone === "incoming" ? "Novo registro" : "Acervo atual"}</small></header>
      <div className="admin-panel-body">
        <div className="admin-person-hero">
          <span>{value(person, "full_name", "name").split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
          <div><small>Nome principal</small><strong>{value(person, "full_name", "name")}</strong></div>
        </div>
        <dl className="admin-definition-grid admin-section-gap">
          <div><dt>Apelidos</dt><dd>{value(person, "aliases", "nicknames")}</dd></div>
          <div><dt>País</dt><dd>{value(person, "country")}</dd></div>
          <div><dt>Cidade</dt><dd>{value(person, "city")}</dd></div>
          <div><dt>Equipe</dt><dd>{value(person, "team", "organization")}</dd></div>
          <div><dt>Fonte</dt><dd>{value(person, "source")}</dd></div>
          <div><dt>Histórico</dt><dd>{value(person, "history")}</dd></div>
        </dl>
        <details className="admin-raw-details">
          <summary>Ver dados técnicos</summary>
          <pre>{JSON.stringify(person ?? {}, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}

export default function DuplicateComparisonPage({ params }: { params: { id: string } }) {
  const [duplicate, setDuplicate] = useState<any>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setState("loading");
      const response = await adminApiFetch(`/review/duplicates/${params.id}`);
      if (!response.ok) throw new Error(response.status === 404 ? "Candidato não encontrado." : "Não foi possível carregar a comparação.");
      setDuplicate(await response.json());
      setState("ready");
    } catch (error) {
      if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar.");
      setState("error");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (action: "merge" | "keep-separate" | "uncertain") => {
    if (action !== "merge" && note.trim().length < 5) {
      setMessage("Registre uma justificativa antes de continuar.");
      return;
    }
    if (
      action === "merge" &&
      !window.confirm("Unir estas pessoas e preservar nomes alternativos, fontes, linhas importadas e histórico?")
    ) return;

    try {
      setState("saving");
      const response = await adminApiFetch(`/review/duplicates/${params.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ notes: note.trim() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a decisão.");
      setMessage("Decisão registrada com sucesso.");
      await load();
    } catch (error) {
      if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
      setState("ready");
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  const confidence = Number(duplicate?.confidence ?? duplicate?.similarityConfidence ?? 0);

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/review/duplicates">← Voltar às duplicidades</Link>
          <div className="admin-eyebrow">Comparação individual</div>
          <h1 className="admin-page-title">É a mesma pessoa?</h1>
          <p className="admin-page-lead">Confira nomes, equipes, localização e fontes antes de decidir.</p>
        </div>
        {duplicate ? <div className="admin-confidence-seal"><small>Confiança</small><strong>{Math.round(confidence * 100)}%</strong></div> : null}
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}
      {state === "loading" && !duplicate ? <section className="admin-panel admin-empty admin-loading"><strong>Montando comparação…</strong></section> : null}

      {duplicate ? (
        <>
          <div className="admin-compare-grid">
            <PersonPanel title="Pessoa recebida" person={duplicate.incomingPerson ?? duplicate.incomingRecord} tone="incoming" />
            <div className="admin-compare-mark" aria-hidden="true">≈</div>
            <PersonPanel title="Pessoa existente" person={duplicate.existingPerson ?? duplicate.possibleExistingRecord} tone="existing" />
          </div>

          <section className="admin-panel admin-section-gap">
            <header className="admin-panel-head"><h2>Parecer da curadoria</h2><small>Obrigatório para ressalvas</small></header>
            <div className="admin-panel-body">
              <label className="admin-field">
                Justificativa e observações
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="O que confirma ou diferencia esses registros?" />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-section-gap">
            <header className="admin-panel-head"><h2>Histórico de auditoria</h2><small>{duplicate.auditHistory?.length ?? 0} eventos</small></header>
            <div className="admin-timeline">
              {(duplicate.auditHistory ?? []).map((entry: any, index: number) => (
                <article key={entry.id ?? index}>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{String(entry.action ?? "alteração").replaceAll("_", " ")}</strong>
                    <p>{entry.notes ?? entry.details ?? "Sem observações."}</p>
                    <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("pt-BR") : ""}</small>
                  </div>
                </article>
              ))}
              {!duplicate.auditHistory?.length ? <div className="admin-empty">Ainda não há decisões registradas.</div> : null}
            </div>
          </section>

          <div className="admin-decision-bar">
            <small>Unir é uma ação sensível: vínculos e fontes passarão para um único registro.</small>
            <div className="admin-decision-actions">
              <button className="admin-button" disabled={state === "saving"} onClick={() => void decide("merge")}>É a mesma pessoa · unir</button>
              <button className="admin-button-secondary" disabled={state === "saving"} onClick={() => void decide("keep-separate")}>São pessoas diferentes</button>
              <button className="admin-button-warning" disabled={state === "saving"} onClick={() => void decide("uncertain")}>Ainda há dúvida</button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

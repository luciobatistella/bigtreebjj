"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../lib/adminApi";

const initialFilters = {
  entityType: "",
  importJobId: "",
  status: "open",
  minConfidence: "",
  maxConfidence: "",
  country: "",
  organizationType: ""
};

export default function DuplicateReviewPage() {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");

  const handleError = (error: unknown) => {
    if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
    setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    setState("ready");
  };

  const load = useCallback(async () => {
    setState("loading");
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    const response = await adminApiFetch(`/review/duplicates?${query.toString()}`);
    if (!response.ok) throw new Error("Não foi possível carregar as duplicidades.");
    const payload = await response.json();
    setDuplicates(Array.isArray(payload) ? payload : []);
    setState("ready");
  }, [filters]);

  useEffect(() => {
    void load().catch(handleError);
    // O tratamento não depende de estado externo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelected([]);
    void load().catch(handleError);
  };

  const bulk = async (
    action: "ignore_low_confidence" | "keep_separate" | "needs_manual_review"
  ) => {
    try {
      setState("saving");
      const response = await adminApiFetch("/review/duplicates/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: selected.length ? selected : undefined,
          filters: selected.length ? undefined : filters,
          action
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A ação em lote falhou.");
      setMessage(`${payload.updated} atualizada(s); ${payload.skipped} ignorada(s).`);
      setSelected([]);
      await load();
    } catch (error) {
      handleError(error);
    }
  };

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
    );
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <div className="admin-eyebrow">Integridade do acervo</div>
          <h1 className="admin-page-title">Possíveis duplicidades</h1>
          <p className="admin-page-lead">
            Compare registros antes de unir pessoas. A fusão nunca acontece automaticamente.
          </p>
        </div>
        <span className="admin-live-badge">Decisão humana</span>
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <form className="admin-panel" onSubmit={applyFilters}>
        <header className="admin-panel-head"><h2>Filtros</h2><small>Refinar candidatos</small></header>
        <div className="admin-panel-body admin-filter-grid">
          <label className="admin-field">
            Tipo de registro
            <select value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
              <option value="">Todos</option>
              <option value="people">Pessoas</option>
              <option value="organizations">Organizações</option>
            </select>
          </label>
          <label className="admin-field">
            Status
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Todos</option>
              <option value="open">Em aberto</option>
              <option value="manual_review">Revisão manual</option>
              <option value="ignored">Ignorada</option>
              <option value="keep_separate">Manter separados</option>
            </select>
          </label>
          <label className="admin-field">País<input value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })} /></label>
          <label className="admin-field">Lote de importação<input value={filters.importJobId} onChange={(event) => setFilters({ ...filters, importJobId: event.target.value })} /></label>
          <label className="admin-field">Confiança mínima<input inputMode="decimal" value={filters.minConfidence} onChange={(event) => setFilters({ ...filters, minConfidence: event.target.value })} /></label>
          <label className="admin-field">Confiança máxima<input inputMode="decimal" value={filters.maxConfidence} onChange={(event) => setFilters({ ...filters, maxConfidence: event.target.value })} /></label>
          <button className="admin-button" type="submit">Aplicar filtros</button>
        </div>
      </form>

      <section className="admin-bulk-bar admin-section-gap">
        <span>{selected.length ? `${selected.length} selecionada(s)` : "Ações usam o filtro atual"}</span>
        <div>
          <button className="admin-button-secondary" disabled={state === "saving"} onClick={() => void bulk("needs_manual_review")}>Exigir revisão</button>
          <button className="admin-button-secondary" disabled={state === "saving"} onClick={() => void bulk("keep_separate")}>Manter separados</button>
          <button className="admin-button-warning" disabled={state === "saving"} onClick={() => void bulk("ignore_low_confidence")}>Ignorar baixa confiança</button>
        </div>
      </section>

      <section className="admin-panel admin-section-gap">
        <header className="admin-panel-head">
          <h2>Candidatos encontrados</h2>
          <small>{state === "loading" ? "carregando" : `${duplicates.length} registros`}</small>
        </header>
        <div className="admin-duplicate-list">
          {duplicates.map((candidate) => {
            const confidence = Number(candidate.confidence ?? candidate.similarityConfidence ?? 0);
            const incomingName =
              candidate.incomingPerson?.full_name ??
              candidate.incomingPerson?.name ??
              candidate.incomingRecord?.full_name ??
              candidate.incomingRecord?.name ??
              "Registro recebido";
            const existingName =
              candidate.existingPerson?.full_name ??
              candidate.existingPerson?.name ??
              candidate.possibleExistingRecord?.full_name ??
              candidate.possibleExistingRecord?.name ??
              "Registro existente";
            return (
              <article className="admin-duplicate-card" key={candidate.id}>
                <label className="admin-check" aria-label={`Selecionar ${incomingName}`}>
                  <input type="checkbox" checked={selected.includes(candidate.id)} onChange={(event) => toggle(candidate.id, event.target.checked)} />
                  <span />
                </label>
                <div className="admin-duplicate-pair">
                  <div><small>Recebido</small><strong>{incomingName}</strong></div>
                  <span aria-hidden="true">≈</span>
                  <div><small>Existente</small><strong>{existingName}</strong></div>
                </div>
                <div className="admin-confidence">
                  <small>Confiança</small>
                  <strong>{Math.round(confidence * 100)}%</strong>
                </div>
                <span className="admin-status-badge">{candidate.status}</span>
                <Link className="admin-button-secondary" href={candidate.openComparisonUrl ?? `/admin/review/duplicates/${candidate.id}`}>Comparar</Link>
              </article>
            );
          })}
          {state === "loading" ? <div className="admin-empty admin-loading"><strong>Procurando combinações…</strong></div> : null}
          {state === "ready" && !duplicates.length ? <div className="admin-empty"><strong>Nenhuma duplicidade</strong>O acervo está limpo para este filtro.</div> : null}
        </div>
      </section>
    </main>
  );
}

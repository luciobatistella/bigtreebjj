"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../lib/adminApi";

export default function ExternalSourcePage() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");

  const handleError = (error: unknown) => {
    if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
    setMessage(error instanceof Error ? error.message : "A operação falhou.");
  };

  const load = async () => {
    const response = await adminApiFetch("/admin/sources/bjjheroes");
    if (!response.ok) throw new Error("Não foi possível carregar o conector.");
    setStatus(await response.json());
  };

  useEffect(() => {
    void load().catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (path: string, body: Record<string, unknown> = {}) => {
    try {
      const response = await adminApiFetch(path, { method: "POST", body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A operação falhou.");
      setStatus(payload);
      setMessage("Estado do conector atualizado.");
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <div className="admin-eyebrow">Fonte de descoberta</div>
          <h1 className="admin-page-title">Conector externo</h1>
          <p className="admin-page-lead">
            Descoberta conservadora de fatos estruturados, sem importar biografias, fotos ou conteúdo editorial.
          </p>
        </div>
        <span className={`admin-status-badge ${status?.paused ? "is-rejected" : "is-approved"}`}>
          {status?.paused ? "Pausado" : "Ativo"}
        </span>
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <section className="admin-metrics">
        {[
          ["Catálogo descoberto", status?.catalogSizeDiscovered ?? 0],
          ["Perfis na fila", status?.profilesQueued ?? 0],
          ["Possíveis duplicidades", status?.duplicateCandidates ?? 0],
          ["Tarefas criadas", status?.reviewTasksCreated ?? 0]
        ].map(([label, value]) => (
          <article className="admin-metric" key={String(label)}><small>{label}</small><strong>{value}</strong></article>
        ))}
      </section>

      <div className="admin-grid-two">
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Controles</h2><small>Modo conservador</small></header>
          <div className="admin-panel-body">
            <p className="admin-evidence-note">{status?.rateLimitStatus ?? "Limite de consultas ainda não carregado."}</p>
            <div className="admin-inline-actions admin-section-gap">
              <button className="admin-button" onClick={() => void post("/admin/sources/bjjheroes/dry-run", { mode: "conservative", limit: 10 })}>Simular 10 perfis</button>
              <button className="admin-button-warning" onClick={() => void post("/admin/sources/bjjheroes/pause", { reason: "Pausado pela curadoria" })}>Pausar</button>
              <button className="admin-button-secondary" onClick={() => void post("/admin/sources/bjjheroes/resume")}>Retomar</button>
              <Link className="admin-button-secondary" href="/admin/imports/bjjheroes">Importar URL manualmente</Link>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Registros de atividade</h2><small>{status?.crawlLogs?.length ?? 0} eventos</small></header>
          <div className="admin-stack-list">
            {(status?.crawlLogs ?? []).map((log: any) => (
              <article key={log.id}><strong>{log.message}</strong><small>{log.createdAt}{log.sourceUrl ? ` · ${log.sourceUrl}` : ""}</small></article>
            ))}
            {!status?.crawlLogs?.length ? <div className="admin-empty">Nenhuma atividade recente.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

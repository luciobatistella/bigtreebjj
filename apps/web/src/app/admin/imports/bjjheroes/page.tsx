"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../lib/adminApi";

export default function ExternalProfileImportPage() {
  const [profileUrl, setProfileUrl] = useState("");
  const [externalName, setExternalName] = useState("");
  const [listedTeamText, setListedTeamText] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");

  const handleError = (error: unknown) => {
    if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
    setMessage(error instanceof Error ? error.message : "A operação falhou.");
  };

  useEffect(() => {
    adminApiFetch("/admin/imports/bjjheroes")
      .then(async (response) => response.ok && setStatus(await response.json()))
      .catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: { preventDefault(): void }, dryRun: boolean) => {
    event.preventDefault();
    try {
      const response = await adminApiFetch("/admin/imports/bjjheroes/manual-profile", {
        method: "POST",
        body: JSON.stringify({ profileUrl, externalName, listedTeamText, dryRun })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível importar.");
      setStatus(payload);
      setMessage(
        dryRun
          ? "Simulação concluída sem criar registros."
          : `Lote pendente criado: ${payload.candidateImportJobId}`
      );
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/imports">← Voltar às importações</Link>
          <div className="admin-eyebrow">Fonte externa</div>
          <h1 className="admin-page-title">Importar perfil de referência</h1>
          <p className="admin-page-lead">
            Capture apenas fatos estruturados e a URL de origem. Biografias e imagens de terceiros não podem ser copiadas.
          </p>
        </div>
        <span className="admin-live-badge">Sempre pendente</span>
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <section className="admin-panel">
        <header className="admin-panel-head"><h2>Perfil selecionado</h2><small>Revisão antes da árvore</small></header>
        <form className="admin-panel-body admin-import-form" onSubmit={(event) => void submit(event, false)}>
          <label className="admin-field">URL do perfil<input type="url" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://…" required /></label>
          <div className="admin-form-grid">
            <label className="admin-field">Nome externo<input value={externalName} onChange={(event) => setExternalName(event.target.value)} /></label>
            <label className="admin-field">Equipe citada<input value={listedTeamText} onChange={(event) => setListedTeamText(event.target.value)} /></label>
          </div>
          <div className="admin-inline-actions">
            <button className="admin-button" type="submit">Criar lote pendente</button>
            <button className="admin-button-secondary" type="button" onClick={(event) => void submit(event, true)}>Apenas simular</button>
            {status?.lastImportJobId ? <Link className="admin-button-secondary" href={`/admin/imports/${status.lastImportJobId}`}>Abrir último lote</Link> : null}
          </div>
        </form>
      </section>

      <section className="admin-metrics admin-section-gap">
        {[
          ["Perfis na fila", status?.profilesQueued ?? 0],
          ["Perfis consultados", status?.profilesFetched ?? 0],
          ["Perfis ignorados", status?.profilesSkipped ?? 0],
          ["Tarefas de revisão", status?.reviewTasksCreated ?? 0]
        ].map(([label, value]) => (
          <article className="admin-metric" key={String(label)}><small>{label}</small><strong>{value}</strong></article>
        ))}
      </section>
    </main>
  );
}

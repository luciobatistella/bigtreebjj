"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../lib/adminApi";

type ImportJob = {
  id: string;
  originalFileName: string;
  status: string;
  importType: string;
  importCategory?: string;
  summary?: string;
};

export default function ImportAdminPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("csv");
  const [importCategory, setImportCategory] = useState("people");
  const [delimiter, setDelimiter] = useState(",");
  const [worksheet, setWorksheet] = useState("");
  const [table, setTable] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingDemianBatch, setIsPreparingDemianBatch] = useState(false);
  const [preparedDemianJobs, setPreparedDemianJobs] = useState<
    Array<{ id: string; fileName: string }>
  >([]);
  const [presets, setPresets] = useState<any>(null);

  const handleError = (error: unknown) => {
    if (error instanceof Error && error.name === "AdminSessionError") {
      goToAdminLogin();
      return;
    }
    setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
  };

  const refreshJobs = useCallback(async () => {
    const response = await adminApiFetch("/imports");
    if (!response.ok) throw new Error("Não foi possível carregar as importações.");
    setJobs(await response.json());
  }, []);

  useEffect(() => {
    void refreshJobs().catch(handleError);
    adminApiFetch("/imports/presets/research")
      .then(async (response) => setPresets(response.ok ? await response.json() : null))
      .catch(handleError);
    // O tratamento não depende de estado externo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshJobs]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage("Escolha um arquivo antes de iniciar a importação.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("importType", importType);
    formData.append("importCategory", importCategory);
    formData.append("options", JSON.stringify({
      delimiter,
      worksheet: worksheet || undefined,
      table: table || undefined
    }));

    try {
      const response = await adminApiFetch("/imports/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao enviar o arquivo.");
      setMessage(`Lote criado com sucesso: ${payload.id}`);
      setFile(null);
      await refreshJobs();
    } catch (error) {
      handleError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepareDemianBatch = async () => {
    if (
      !window.confirm(
        "Adicionar quatro relações documentadas de Demian Maia à fila privada de curadoria? Nada será publicado automaticamente."
      )
    ) return;
    setIsPreparingDemianBatch(true);
    setMessage("");
    try {
      const response = await adminApiFetch("/admin/imports/curated/demian-maia", {
        method: "POST",
        body: JSON.stringify({})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível preparar o lote editorial.");
      }
      setPreparedDemianJobs(payload.jobs ?? []);
      setMessage(
        `${payload.claimsReadyForReview ?? 4} relações foram colocadas na fila privada. Revise cada fonte antes de publicar.`
      );
      await refreshJobs();
    } catch (error) {
      handleError(error);
    } finally {
      setIsPreparingDemianBatch(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <div className="admin-eyebrow">Centro de importação</div>
          <h1 className="admin-page-title">Novos dados</h1>
          <p className="admin-page-lead">
            Envie arquivos de pesquisa para validação. Nenhuma linha entra na árvore pública automaticamente.
          </p>
        </div>
        <span className="admin-live-badge">Revisão obrigatória</span>
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <section className="admin-panel">
        <header className="admin-panel-head">
          <h2>Lote editorial preparado · Demian Maia</h2>
          <small>4 relações · fontes oficiais · publicação manual</small>
        </header>
        <div className="admin-panel-body">
          <p className="admin-evidence-note">
            Mark Turner, Daniel Amado Perez, Nathan Drona e Vitalino Silva possuem
            evidência direta no site oficial de Demian Maia. O lote usa o registro
            canônico <code>name:demian-maia</code> e exclui Nelson de Souza Lopes.
          </p>
          <div className="admin-inline-actions admin-section-gap">
            <button
              className="admin-button"
              type="button"
              disabled={isPreparingDemianBatch}
              onClick={() => void prepareDemianBatch()}
            >
              {isPreparingDemianBatch
                ? "Preparando fila…"
                : "Adicionar à fila de curadoria"}
            </button>
            {preparedDemianJobs.map((job) => (
              <Link
                className="admin-button-secondary"
                href={`/admin/imports/${job.id}`}
                key={job.id}
              >
                Abrir {job.fileName}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="admin-grid-two">
        <form className="admin-panel" onSubmit={handleSubmit}>
          <header className="admin-panel-head"><h2>Criar lote de importação</h2><small>CSV · XLSX · SQLite</small></header>
          <div className="admin-panel-body admin-import-form">
            <div className="admin-preset-note">
              <strong>{presets?.protectedPreset?.name ?? "Conjunto histórico protegido"}</strong>
              <p>Relações entram pendentes, evidências permanecem privadas e duplicidades exigem decisão humana.</p>
            </div>
            <label className="admin-file-drop">
              <input
                type="file"
                accept=".csv,.xlsx,.sqlite,.db"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
              />
              <span>{file ? "Arquivo selecionado" : "Escolher arquivo de pesquisa"}</span>
              <strong>{file?.name ?? "Toque aqui ou arraste para selecionar"}</strong>
              {file ? <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small> : null}
            </label>
            <div className="admin-form-grid">
              <label className="admin-field">
                Formato
                <select value={importType} onChange={(event) => setImportType(event.target.value)}>
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </label>
              <label className="admin-field">
                Conteúdo
                <select value={importCategory} onChange={(event) => setImportCategory(event.target.value)}>
                  <option value="people">Pessoas</option>
                  <option value="organizations">Organizações</option>
                  <option value="sources">Fontes</option>
                  <option value="lineage_claims">Relações de linhagem</option>
                  <option value="claim_evidence">Evidências de linhagem</option>
                </select>
              </label>
            </div>
            {importType === "csv" ? (
              <label className="admin-field">Separador do CSV<input value={delimiter} onChange={(event) => setDelimiter(event.target.value)} placeholder="," /></label>
            ) : null}
            {importType === "xlsx" ? (
              <label className="admin-field">Nome da planilha<input value={worksheet} onChange={(event) => setWorksheet(event.target.value)} placeholder="Planilha1" /></label>
            ) : null}
            {importType === "sqlite" ? (
              <label className="admin-field">Nome da tabela<input value={table} onChange={(event) => setTable(event.target.value)} placeholder="people" /></label>
            ) : null}
            <button className="admin-button admin-submit-wide" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enviando e protegendo…" : "Criar lote para revisão"}
            </button>
          </div>
        </form>

        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Importações recentes</h2><small>{jobs.length} lotes</small></header>
          <div className="admin-action-list">
            {jobs.map((job, index) => (
              <Link className="admin-action-row" href={`/admin/imports/${job.id}`} key={job.id}>
                <span className="admin-action-number">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{job.originalFileName}</strong>
                  <small>{job.importType.toUpperCase()} · {job.importCategory ?? "pessoas"}</small>
                </span>
                <span className="admin-status-badge">{job.status}</span>
              </Link>
            ))}
            {!jobs.length ? (
              <div className="admin-empty"><strong>Nenhum lote criado</strong>As importações aparecerão aqui.</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

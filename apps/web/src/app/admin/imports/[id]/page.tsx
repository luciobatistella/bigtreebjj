"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../../../lib/adminApi";

const tabs = [
  ["overview", "Visão geral"],
  ["rows", "Linhas"],
  ["records", "Registros criados"],
  ["warnings", "Alertas"],
  ["duplicates", "Duplicidades"],
  ["queue", "Fila de revisão"],
  ["report", "Relatório"],
  ["audit", "Auditoria"]
] as const;

type TabId = (typeof tabs)[number][0];

function parseJson(value: unknown) {
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="admin-json">{JSON.stringify(parseJson(value), null, 2)}</pre>;
}

export default function ImportJobDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [detail, setDetail] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, any[]>>({});
  const [report, setReport] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const responses = await Promise.all([
        adminApiFetch(`/imports/${params.id}/detail`),
        adminApiFetch(`/imports/${params.id}/rows`),
        adminApiFetch(`/imports/${params.id}/duplicates`),
        adminApiFetch(`/imports/${params.id}/review-queue`),
        adminApiFetch(`/imports/${params.id}/imported-records`),
        adminApiFetch(`/imports/${params.id}/report`),
        adminApiFetch(`/imports/${params.id}/audit-history`)
      ]);
      if (!responses[0].ok) throw new Error("Lote de importação não encontrado.");
      const [detailData, rowsData, duplicateData, queueData, recordsData, reportData, auditData] =
        await Promise.all(responses.map((response) => response.ok ? response.json() : null));
      setDetail(detailData);
      setRows(rowsData ?? []);
      setDuplicates(duplicateData ?? []);
      setQueue(queueData ?? []);
      setRecords(recordsData ?? {});
      setReport(reportData);
      setAudit(auditData ?? []);
    };
    load().catch((error) => {
      if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o lote.");
    });
  }, [params.id]);

  const warnings = useMemo(
    () =>
      rows.filter((row) => {
        const validation = parseJson(row.validationResult) as any;
        return (
          row.status === "review_required" ||
          validation?.valid === false ||
          validation?.warnings?.length ||
          validation?.errors?.length
        );
      }),
    [rows]
  );

  const handleRollback = async () => {
    if (!window.confirm("Reverter os registros criados por este lote? O histórico será preservado.")) return;
    try {
      const response = await adminApiFetch(`/imports/${params.id}/rollback`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível reverter.");
      setMessage(`Reversão concluída: ${payload.status ?? "ok"}.`);
    } catch (error) {
      if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
      setMessage(error instanceof Error ? error.message : "A reversão falhou.");
    }
  };

  const handleDownload = async () => {
    try {
      const response = await adminApiFetch(`/imports/${params.id}/download`);
      if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = detail?.originalFileName ?? "arquivo-importado";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error instanceof Error && error.name === "AdminSessionError") return goToAdminLogin();
      setMessage(error instanceof Error ? error.message : "O download falhou.");
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-back-link" href="/admin/imports">← Voltar às importações</Link>
          <div className="admin-eyebrow">Lote de importação</div>
          <h1 className="admin-page-title">{detail?.originalFileName ?? params.id}</h1>
          <p className="admin-page-lead">Acompanhe validação, registros gerados e decisões pendentes.</p>
        </div>
        {detail ? <span className="admin-status-badge">{detail.status}</span> : null}
      </header>

      {message ? <div className="admin-alert" role="status">{message}</div> : null}

      <section className="admin-metrics">
        {[
          ["Linhas recebidas", detail?.totalRows, "total do arquivo"],
          ["Registros importados", detail?.importedRows, "mantidos fora do público até aprovação"],
          ["Exigem revisão", detail?.reviewQueueItemsCreated, "tarefas editoriais"],
          ["Falhas", detail?.failedRows, `${detail?.duplicateCandidates ?? 0} duplicidades`]
        ].map(([label, value, note]) => (
          <article className="admin-metric" key={String(label)}>
            <small>{label}</small><strong>{value ?? "—"}</strong><span>{note}</span>
          </article>
        ))}
      </section>

      <nav className="admin-tabs admin-section-gap" aria-label="Seções do lote">
        {tabs.map(([id, label]) => (
          <button className={`admin-tab ${activeTab === id ? "is-active" : ""}`} key={id} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="admin-detail-grid">
          <section className="admin-panel">
            <header className="admin-panel-head"><h2>Resumo operacional</h2><small>{detail?.importType ?? detail?.fileType}</small></header>
            <div className="admin-panel-body">
              <dl className="admin-definition-grid">
                <div><dt>Arquivo original</dt><dd>{detail?.originalFileName ?? "—"}</dd></div>
                <div><dt>Categoria</dt><dd>{detail?.importCategory ?? "—"}</dd></div>
                <div><dt>Data de envio</dt><dd>{detail?.uploadDate ? new Date(detail.uploadDate).toLocaleString("pt-BR") : "—"}</dd></div>
                <div><dt>Responsável</dt><dd>{detail?.importingUser ?? "—"}</dd></div>
                <div><dt>Linhas ignoradas</dt><dd>{detail?.skippedRows ?? 0}</dd></div>
                <div><dt>Estado da reversão</dt><dd>{detail?.rollbackStatus ?? "não iniciada"}</dd></div>
              </dl>
              <div className="admin-inline-actions admin-section-gap">
                <button className="admin-button-secondary" onClick={() => void handleDownload()}>Baixar original</button>
                <button className="admin-button-danger" onClick={() => void handleRollback()}>Reverter lote</button>
              </div>
            </div>
          </section>
          <section className="admin-panel">
            <header className="admin-panel-head"><h2>Mapeamento e validação</h2><small>Dados técnicos</small></header>
            <div className="admin-panel-body"><JsonBlock value={{ mappedColumns: detail?.mappedColumns, validationSummary: detail?.validationSummary }} /></div>
          </section>
        </div>
      ) : null}

      {activeTab === "rows" ? (
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Linhas recebidas</h2><small>{rows.length} linhas</small></header>
          <div className="admin-stack-list">
            {rows.map((row, index) => (
              <details key={row.id ?? index}>
                <summary><strong>Linha {row.originalRowNumber}</strong><span className="admin-status-badge">{row.status}</span></summary>
                <JsonBlock value={row.rawPayload} />
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "records" ? (
        <section className="admin-record-groups">
          {Object.entries(records).map(([group, items]) => (
            <div className="admin-panel" key={group}>
              <header className="admin-panel-head"><h2>{group}</h2><small>{items.length} registros</small></header>
              <div className="admin-stack-list">
                {items.map((record) => (
                  <Link href={record.adminUrl} key={`${group}-${record.id}`}>
                    <strong>{record.id}</strong>
                    <small>Status: {record.status} · Visibilidade: {record.publicVisibility} · Linha: {record.sourceImportRow}</small>
                  </Link>
                ))}
                {!items.length ? <div className="admin-empty">Nenhum registro neste grupo.</div> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === "warnings" ? (
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Alertas e erros</h2><small>{warnings.length} ocorrências</small></header>
          <div className="admin-stack-list">
            {warnings.map((row) => (
              <details key={row.id ?? row.originalRowNumber}>
                <summary><strong>Linha {row.originalRowNumber}</strong><span className="admin-status-badge is-pending">{row.status}</span></summary>
                <JsonBlock value={row.validationResult} />
              </details>
            ))}
            {!warnings.length ? <div className="admin-empty"><strong>Nenhum alerta</strong>O lote passou pelas validações.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "duplicates" ? (
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Possíveis duplicidades</h2><small>{duplicates.length} candidatos</small></header>
          <div className="admin-action-list">
            {duplicates.map((candidate) => (
              <Link className="admin-action-row" href={candidate.openComparisonUrl} key={candidate.id}>
                <span className="admin-action-number">≈</span>
                <span><strong>Comparação sugerida</strong><small>Confiança: {candidate.similarityConfidence} · Linha: {candidate.importSourceRow}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            {!duplicates.length ? <div className="admin-empty"><strong>Sem duplicidades</strong>Nenhuma combinação foi sugerida.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "queue" ? (
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Fila de revisão</h2><small>{queue.length} tarefas</small></header>
          <div className="admin-action-list">
            {queue.map((item) => (
              <Link className="admin-action-row" href={item.openReviewUrl} key={item.id}>
                <span className="admin-action-number">!</span>
                <span><strong>{item.type} · {item.priority}</strong><small>Entidade: {item.relatedEntity} · Linha: {item.sourceImportRow} · {item.status}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            {!queue.length ? <div className="admin-empty"><strong>Fila limpa</strong>Nenhuma tarefa foi criada.</div> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "report" ? <section className="admin-panel"><header className="admin-panel-head"><h2>Relatório do lote</h2><small>JSON</small></header><div className="admin-panel-body"><JsonBlock value={report} /></div></section> : null}

      {activeTab === "audit" ? (
        <section className="admin-panel">
          <header className="admin-panel-head"><h2>Histórico de auditoria</h2><small>{audit.length} eventos</small></header>
          <div className="admin-timeline">
            {audit.map((entry) => (
              <article key={entry.id}><i aria-hidden="true" /><div><strong>{entry.action}</strong><p>{entry.entityType} · {entry.entityId}</p><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("pt-BR") : ""}</small><JsonBlock value={entry.details} /></div></article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

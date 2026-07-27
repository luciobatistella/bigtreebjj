"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApiFetch, goToAdminLogin } from "../../lib/adminApi";

type ImportJob = {
  id: string;
  originalFileName: string;
  status: string;
  importType: string;
  importCategory?: string | null;
};

type AdminMetrics = {
  totalPeople: number;
  totalOrganizations: number;
  totalSources: number;
  totalLineageClaims: number;
  confirmedClaims: number;
  pendingClaims: number;
  openReviewTasks: number;
  openDuplicateCandidates: number;
  recentImports: ImportJob[];
  importHealth?: {
    latestImportStatus?: string | null;
    rowsNeedingReview?: number;
    failedImportRows?: number;
    unresolvedReferences?: number;
  };
};

export default function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApiFetch("/admin/metrics")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o painel.");
        setMetrics(await response.json());
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AdminSessionError") return goToAdminLogin();
        setError(cause instanceof Error ? cause.message : "Falha ao carregar o painel.");
      });
  }, []);

  const cards = [
    {
      label: "Aguardando curadoria",
      value: metrics?.pendingClaims,
      note: "relações ainda não publicadas"
    },
    {
      label: "Pessoas no acervo",
      value: metrics?.totalPeople,
      note: `${metrics?.totalOrganizations ?? 0} organizações conectadas`
    },
    {
      label: "Linhagens confirmadas",
      value: metrics?.confirmedClaims,
      note: `${metrics?.totalLineageClaims ?? 0} relações registradas`
    },
    {
      label: "Possíveis duplicidades",
      value: metrics?.openDuplicateCandidates,
      note: "candidatos que exigem decisão"
    }
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-head">
        <div>
          <div className="admin-eyebrow">Centro editorial</div>
          <h1 className="admin-page-title">Visão geral</h1>
          <p className="admin-page-lead">
            O estado do acervo, as decisões pendentes e os próximos passos em um só lugar.
          </p>
        </div>
        <span className="admin-live-badge">Sistema ativo</span>
      </header>

      {error ? <div className="admin-alert is-danger" role="alert">{error}</div> : null}

      <section className="admin-metrics" aria-label="Resumo do acervo">
        {cards.map((card) => (
          <article className="admin-metric" key={card.label}>
            <small>{card.label}</small>
            <strong>{card.value ?? "—"}</strong>
            <span>{card.note}</span>
          </article>
        ))}
      </section>

      <div className="admin-grid-two">
        <section className="admin-panel">
          <header className="admin-panel-head">
            <h2>Próximas decisões</h2>
            <small>{metrics?.openReviewTasks ?? 0} tarefas abertas</small>
          </header>
          <div className="admin-action-list">
            <Link className="admin-action-row" href="/admin/review">
              <span className="admin-action-number">01</span>
              <span>
                <strong>Revisar linhagens e solicitações</strong>
                <small>{metrics?.pendingClaims ?? 0} relações aguardando análise editorial</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="admin-action-row" href="/admin/review/duplicates">
              <span className="admin-action-number">02</span>
              <span>
                <strong>Resolver possíveis duplicidades</strong>
                <small>{metrics?.openDuplicateCandidates ?? 0} combinações sugeridas pelo sistema</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="admin-action-row" href="/admin/imports">
              <span className="admin-action-number">03</span>
              <span>
                <strong>Importar novas evidências</strong>
                <small>Pré-visualize, valide e acompanhe cada lote</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="admin-panel">
          <header className="admin-panel-head">
            <h2>Saúde dos dados</h2>
            <small>{metrics?.importHealth?.latestImportStatus ?? "sem importação"}</small>
          </header>
          <div className="admin-panel-body">
            <dl className="admin-health-list">
              <div><dt>Linhas para revisar</dt><dd>{metrics?.importHealth?.rowsNeedingReview ?? 0}</dd></div>
              <div><dt>Linhas com falha</dt><dd>{metrics?.importHealth?.failedImportRows ?? 0}</dd></div>
              <div><dt>Referências não resolvidas</dt><dd>{metrics?.importHealth?.unresolvedReferences ?? 0}</dd></div>
              <div><dt>Fontes registradas</dt><dd>{metrics?.totalSources ?? 0}</dd></div>
            </dl>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-section-gap">
        <header className="admin-panel-head">
          <h2>Importações recentes</h2>
          <Link className="admin-text-link" href="/admin/imports">Ver todas →</Link>
        </header>
        <div className="admin-action-list">
          {(metrics?.recentImports ?? []).map((job, index) => (
            <Link className="admin-action-row" href={`/admin/imports/${job.id}`} key={job.id}>
              <span className="admin-action-number">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{job.originalFileName}</strong>
                <small>{job.importType} · {job.importCategory ?? "pessoas"}</small>
              </span>
              <span className="admin-status-badge">{job.status}</span>
            </Link>
          ))}
          {metrics && !metrics.recentImports?.length ? (
            <div className="admin-empty"><strong>Nenhuma importação</strong>O histórico aparecerá aqui.</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

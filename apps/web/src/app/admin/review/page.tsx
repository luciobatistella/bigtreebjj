"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Submission = {
  id: string;
  protocol: string;
  fullName: string;
  teacherName: string;
  teacherNames?: string[];
  academyTeam?: string | null;
  city?: string | null;
  country?: string | null;
  evidenceUrls: string[];
  hasCertificate?: boolean;
  certificateCount?: number;
  status: string;
  createdAt: string;
};

const filters = [
  ["pending_review", "Pendentes"],
  ["needs_evidence", "Mais evidências"],
  ["approved", "Aprovadas"],
  ["rejected", "Recusadas"],
  ["all", "Todas"]
] as const;

const statusLabel: Record<string, string> = {
  pending_review: "Pendente",
  needs_evidence: "Aguardando evidências",
  approved: "Aprovada",
  rejected: "Recusada"
};

export default function ReviewAdminPage() {
  const [status, setStatus] = useState("pending_review");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const token = window.localStorage.getItem("tbt_admin_token");
    if (!token) {
      setNeedsLogin(true);
      setState("error");
      return () => controller.abort();
    }
    setNeedsLogin(false);
    setState("loading");
    fetch(`${apiBase}/review/submissions?status=${encodeURIComponent(status)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(async (response) => {
        if (response.status === 403) {
          window.localStorage.removeItem("tbt_admin_token");
          setNeedsLogin(true);
        }
        if (!response.ok) throw new Error("Falha ao carregar a fila.");
        return response.json();
      })
      .then((payload) => {
        setSubmissions(Array.isArray(payload) ? payload : []);
        setState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [status]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Community review</p>
            <h1 className="mt-3 text-3xl font-semibold">Solicitações de linhagem</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Pedidos públicos ficam isolados da árvore até a decisão editorial. Aprovar cria a
              pessoa, o vínculo confirmado e o histórico de auditoria.
            </p>
          </div>
          <Link className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800" href="/admin">
            Voltar ao admin
          </Link>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar solicitações">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full border px-4 py-2 text-sm ${
              status === value
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <div className="grid grid-cols-[1.1fr_1fr_.55fr_.3fr] gap-4 border-b border-slate-800 px-5 py-3 text-xs uppercase tracking-[0.14em] text-slate-500 max-md:hidden">
          <span>Solicitante</span>
          <span>Conexão</span>
          <span>Recebida</span>
          <span></span>
        </div>

        {state === "loading" ? <p className="p-8 text-sm text-slate-400">Carregando solicitações…</p> : null}
        {state === "error" ? (
          <div className="p-8">
            <p className="text-sm text-rose-300">
              {needsLogin ? "A fila contém dados privados e exige acesso editorial." : "Não foi possível carregar a fila."}
            </p>
            {needsLogin ? (
              <Link className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" href="/admin/login?next=/admin/review">
                Entrar como editor
              </Link>
            ) : null}
          </div>
        ) : null}
        {state === "ready" && !submissions.length ? (
          <div className="p-10 text-center">
            <p className="text-lg font-medium">Nenhuma solicitação neste filtro.</p>
            <p className="mt-2 text-sm text-slate-400">Novos envios públicos aparecerão aqui.</p>
          </div>
        ) : null}

        {state === "ready"
          ? submissions.map((submission) => (
              <article
                key={submission.id}
                className="grid grid-cols-[1.1fr_1fr_.55fr_.3fr] items-center gap-4 border-b border-slate-800 px-5 py-4 last:border-0 max-md:grid-cols-1"
              >
                <div>
                  <strong className="block text-slate-100">{submission.fullName}</strong>
                  <small className="mt-1 block font-mono text-xs text-slate-500">{submission.protocol}</small>
                </div>
                <div>
                  <span className="block text-sm text-slate-200">
                    {(submission.teacherNames?.length
                      ? submission.teacherNames
                      : [submission.teacherName]
                    ).join(" + ")}
                  </span>
                  <small className="mt-1 block text-xs text-slate-500">
                    {[submission.academyTeam, submission.city, submission.country].filter(Boolean).join(" · ") ||
                      `${submission.evidenceUrls.length} link(s)${submission.hasCertificate ? ` · ${submission.certificateCount ?? 1} certificado(s)` : ""}`}
                  </small>
                </div>
                <div>
                  <span className="block text-sm">{new Date(submission.createdAt).toLocaleDateString("pt-BR")}</span>
                  <small className="mt-1 block text-xs text-amber-300">{statusLabel[submission.status] ?? submission.status}</small>
                </div>
                <Link
                  className="justify-self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  href={`/admin/review/submissions/${submission.id}`}
                >
                  Revisar
                </Link>
              </article>
            ))
          : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 hover:bg-slate-900" href="/admin/review/duplicates">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Base existente</span>
          <strong className="mt-2 block text-lg">Revisar duplicidades</strong>
        </Link>
        <Link className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 hover:bg-slate-900" href="/admin">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Operação</span>
          <strong className="mt-2 block text-lg">Painel administrativo</strong>
        </Link>
      </section>
    </main>
  );
}

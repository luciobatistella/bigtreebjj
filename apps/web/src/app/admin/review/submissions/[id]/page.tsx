"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  certificates?: Array<{
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
  }>;
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

export default function SubmissionReviewPage({ params }: { params: { id: string } }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("Carregando solicitação…");
  const [certificateState, setCertificateState] = useState<"idle" | "loading" | "error">("idle");

  const load = async () => {
    const token = window.localStorage.getItem("tbt_admin_token");
    if (!token) {
      window.location.href = `/admin/login?next=${encodeURIComponent(`/admin/review/submissions/${params.id}`)}`;
      return;
    }
    const response = await fetch(`${apiBase}/review/submissions/${params.id}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json();
    if (response.status === 403) {
      window.localStorage.removeItem("tbt_admin_token");
      window.location.href = `/admin/login?next=${encodeURIComponent(`/admin/review/submissions/${params.id}`)}`;
      return;
    }
    if (!response.ok) throw new Error(payload.error ?? "Solicitação não encontrada.");
    setSubmission(payload as Submission);
    setNotes((payload as Submission).reviewerNotes ?? "");
    setState("ready");
    setMessage("");
  };

  useEffect(() => {
    load().catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Falha ao carregar.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const decide = async (action: "approve" | "reject" | "request_evidence") => {
    if (!submission) return;
    if (action !== "approve" && notes.trim().length < 8) {
      setMessage("Escreva uma orientação clara para o solicitante antes desta decisão.");
      return;
    }
    if (
      action === "approve" &&
      !window.confirm(
        `Aprovar ${submission.fullName} como conexão de ${teachersLabel}? Isso publicará ${teacherNames.length} vínculo(s) confirmado(s) na árvore.`
      )
    ) {
      return;
    }
    setState("saving");
    setMessage("Salvando decisão…");
    try {
      const token = window.localStorage.getItem("tbt_admin_token");
      if (!token) {
        window.location.href = `/admin/login?next=${encodeURIComponent(`/admin/review/submissions/${params.id}`)}`;
        return;
      }
      const response = await fetch(`${apiBase}/review/submissions/${submission.id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reviewerNotes: notes,
          teacherPersonId: submission.teacherPersonId || undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a decisão.");
      setSubmission(payload as Submission);
      setState("ready");
      setMessage(
        action === "approve"
          ? "Aprovada e publicada na árvore."
          : action === "reject"
            ? "Solicitação recusada."
            : "Solicitante marcado como aguardando mais evidências."
      );
      await load();
    } catch (error) {
      setState("ready");
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a decisão.");
    }
  };

  const downloadCertificate = async (certificateId?: string, originalName?: string) => {
    if (!submission?.hasCertificate) return;
    const token = window.localStorage.getItem("tbt_admin_token");
    if (!token) {
      window.location.href = `/admin/login?next=${encodeURIComponent(`/admin/review/submissions/${params.id}`)}`;
      return;
    }
    setCertificateState("loading");
    try {
      const certificatePath = certificateId
        ? `/review/submissions/${submission.id}/certificates/${certificateId}`
        : `/review/submissions/${submission.id}/certificate`;
      const response = await fetch(`${apiBase}${certificatePath}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Não foi possível baixar o certificado.");
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = originalName || submission.certificateOriginalName || "certificado";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setCertificateState("idle");
    } catch (error) {
      setCertificateState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível baixar o certificado.");
    }
  };

  if (!submission) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
        <Link className="text-sm text-emerald-400" href="/admin/review">← Voltar à fila</Link>
        <p className={`mt-8 ${state === "error" ? "text-rose-300" : "text-slate-400"}`}>{message}</p>
      </main>
    );
  }

  const isPending = submission.status === "pending_review" || submission.status === "needs_evidence";
  const teacherNames = submission.teacherNames?.length
    ? submission.teacherNames
    : [submission.teacherName];
  const teacherIds = submission.teacherPersonIds?.length
    ? submission.teacherPersonIds
    : submission.teacherPersonId
      ? [submission.teacherPersonId]
      : [];
  const teachersLabel = new Intl.ListFormat("pt-BR", {
    style: "long",
    type: "conjunction"
  }).format(teacherNames);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <Link className="text-sm text-emerald-400" href="/admin/review">← Voltar à fila</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{submission.protocol}</p>
            <h1 className="mt-2 text-3xl font-semibold">
              {submission.fullName} <span className="text-slate-500">→</span> {teachersLabel}
            </h1>
            <p className="mt-2 text-slate-300">{claimLabels[submission.claimType] ?? submission.claimType}</p>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.12em] text-amber-300">
            {submission.status}
          </span>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Conexão declarada</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Solicitante</dt><dd>{submission.fullName}</dd></div>
            <div><dt className="text-slate-500">Professor(es)</dt><dd>{teachersLabel}</dd></div>
            <div><dt className="text-slate-500">IDs dos professores</dt><dd className="font-mono text-xs">{teacherIds.join(", ") || "não resolvido"}</dd></div>
            <div><dt className="text-slate-500">Graduação</dt><dd>{submission.promotionDate ? new Date(submission.promotionDate).toLocaleDateString("pt-BR") : "não informada"}</dd></div>
            <div><dt className="text-slate-500">Percurso</dt><dd>{submission.graduationTrack === "youth" ? "Início juvenil" : "Início adulto"}</dd></div>
            <div><dt className="text-slate-500">Declaração documental</dt><dd>{submission.certificateCompletenessConfirmed ? "Todos os certificados declarados" : "Não confirmada"}</dd></div>
            <div><dt className="text-slate-500">Equipe</dt><dd>{submission.academyTeam ?? "não informada"}</dd></div>
            <div><dt className="text-slate-500">Local</dt><dd>{[submission.city, submission.country].filter(Boolean).join(", ") || "não informado"}</dd></div>
            <div><dt className="text-slate-500">Recebida</dt><dd>{new Date(submission.createdAt).toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-slate-500">Vínculo publicado</dt><dd className="font-mono text-xs">{submission.lineageClaimId ?? "ainda não"}</dd></div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Contato privado</h2>
          <p className="mt-2 text-xs text-slate-500">Não é exibido no site público.</p>
          <div className="mt-5 grid gap-3">
            <a className="rounded-lg border border-slate-700 p-3 hover:bg-slate-800" href={`mailto:${submission.email}`}>
              <small className="block text-slate-500">E-mail</small>
              <strong>{submission.email}</strong>
            </a>
            {submission.instagram ? (
              <div className="rounded-lg border border-slate-700 p-3">
                <small className="block text-slate-500">Instagram</small>
                <strong>{submission.instagram}</strong>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-xl font-semibold">Evidências enviadas</h2>
        {submission.certificates?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {submission.certificates.map((certificate, index) => (
              <article
                key={certificate.id}
                className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4"
              >
                <div className="min-w-0">
                  <small className="block text-xs uppercase tracking-[0.14em] text-emerald-400">
                    {String(index + 1).padStart(2, "0")} · {certificate.beltLabel}
                  </small>
                  <strong className="mt-2 block truncate">{certificate.originalName}</strong>
                  <span className="mt-1 block font-mono text-xs text-slate-500">
                    {certificate.track === "youth" ? "Percurso juvenil" : "Percurso adulto"}
                    {certificate.awardedAt
                      ? ` · ${new Date(certificate.awardedAt).toLocaleDateString("pt-BR")}`
                      : ""}
                    {` · ${(certificate.size / 1024 / 1024).toFixed(2)} MB`}
                  </span>
                  <span className="mt-2 block truncate font-mono text-[10px] text-slate-600">
                    SHA-256 {certificate.sha256}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadCertificate(certificate.id, certificate.originalName)}
                  disabled={certificateState === "loading"}
                  className="self-start rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
                >
                  {certificateState === "loading" ? "Baixando…" : "Abrir certificado"}
                </button>
              </article>
            ))}
          </div>
        ) : submission.hasCertificate ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
            <div className="min-w-0">
              <small className="block text-xs uppercase tracking-[0.14em] text-emerald-400">
                Certificado privado · pré-evidência
              </small>
              <strong className="mt-1 block truncate">{submission.certificateOriginalName}</strong>
              <span className="mt-1 block font-mono text-xs text-slate-500">
                {submission.certificateMimeType}
                {submission.certificateSize
                  ? ` · ${(submission.certificateSize / 1024 / 1024).toFixed(2)} MB`
                  : ""}
              </span>
              {submission.certificateSha256 ? (
                <span className="mt-1 block truncate font-mono text-[10px] text-slate-600">
                  SHA-256 {submission.certificateSha256}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void downloadCertificate(undefined, submission.certificateOriginalName ?? undefined)}
              disabled={certificateState === "loading"}
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
            >
              {certificateState === "loading" ? "Baixando…" : "Abrir certificado"}
            </button>
          </div>
        ) : null}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {submission.evidenceNotes || "Sem relato textual."}
        </p>
        <div className="mt-5 grid gap-2">
          {submission.evidenceUrls.map((url) => (
            <a
              key={url}
              className="break-all rounded-lg border border-slate-700 px-4 py-3 text-sm text-emerald-300 hover:bg-slate-800"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {url} ↗
            </a>
          ))}
          {!submission.evidenceUrls.length ? <p className="text-sm text-slate-500">Nenhum link anexado.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-xl font-semibold">Decisão editorial</h2>
        <label className="mt-4 block text-sm text-slate-300">
          Mensagem e notas da revisão
          <textarea
            className="mt-2 min-h-32 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Explique a decisão; esta mensagem aparece na consulta pública do protocolo."
          />
        </label>
        {message ? <p className="mt-3 text-sm text-amber-300" role="status">{message}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!isPending || state === "saving"}
            onClick={() => void decide("approve")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aprovar e publicar
          </button>
          <button
            type="button"
            disabled={!isPending || state === "saving"}
            onClick={() => void decide("request_evidence")}
            className="rounded-lg border border-amber-600 px-4 py-2 text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Pedir evidências
          </button>
          <button
            type="button"
            disabled={!isPending || state === "saving"}
            onClick={() => void decide("reject")}
            className="rounded-lg border border-rose-700 px-4 py-2 text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Recusar
          </button>
        </div>
      </section>
    </main>
  );
}

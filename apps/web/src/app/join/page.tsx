import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./JoinForm";
import "./join.css";
import { getServerLocale } from "../i18n/serverLocale";

export function generateMetadata(): Metadata {
  const locale = getServerLocale();
  return locale === "en"
    ? {
        title: "Join the tree — The Big Tree BJJ",
        description:
          "Submit your black-belt connection for editorial review and inclusion in the jiu-jitsu tree."
      }
    : {
        title: "Entrar na árvore — The Big Tree BJJ",
        description:
          "Envie sua conexão de faixa-preta para análise editorial e inclusão na árvore do jiu-jitsu."
      };
}

export default function JoinPage({
  searchParams
}: {
  searchParams: { teacher?: string; teacherId?: string };
}) {
  const teacherName = searchParams.teacher?.trim() ?? "";
  const teacherId = searchParams.teacherId?.trim() ?? "";
  const locale = getServerLocale();
  const copy =
    locale === "en"
      ? {
          desk: "Community lineage desk",
          back: "Back to Explorer",
          eyebrow: "Inclusion request · editorial review",
          title: "Your name is also part",
          emphasis: "of the history.",
          lede:
            "Did you receive your black belt from someone already in the tree? Tell us about that connection. We verify the information before publishing it.",
          steps: [
            ["You submit", "Your name, instructor and available evidence."],
            ["We review", "We check duplicates, relationships and sources."],
            ["The tree grows", "Only after editorial approval."]
          ]
        }
      : {
          desk: "Community lineage desk",
          back: "Voltar ao Explorer",
          eyebrow: "Solicitação de inclusão · revisão editorial",
          title: "Seu nome também faz parte",
          emphasis: "da história.",
          lede:
            "Recebeu a faixa-preta de alguém que já está na árvore? Conte essa conexão. Nós verificamos a informação antes de publicá-la.",
          steps: [
            ["Você envia", "Nome, professor e evidências disponíveis."],
            ["Nós revisamos", "Conferimos duplicidade, vínculo e fontes."],
            ["A árvore cresce", "Só depois da aprovação editorial."]
          ]
        };

  return (
    <main className="join-page">
      <header className="join-header">
        <Link href="/" className="join-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" />
          <span>
            <strong>The Big Tree BJJ</strong>
            <small>{copy.desk}</small>
          </span>
        </Link>
        <Link href="/explore" className="join-back">
          {copy.back}
        </Link>
      </header>

      <section className="join-intro">
        <div>
          <p className="join-eyebrow">{copy.eyebrow}</p>
          <h1>
            {copy.title} <em>{copy.emphasis}</em>
          </h1>
          <p className="join-lede">{copy.lede}</p>
        </div>
        <ol className="join-steps">
          {copy.steps.map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{title}</strong><small>{description}</small></div>
            </li>
          ))}
        </ol>
      </section>

      <JoinForm initialTeacherName={teacherName} initialTeacherId={teacherId} locale={locale} />
    </main>
  );
}

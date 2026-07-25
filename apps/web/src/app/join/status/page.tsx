import type { Metadata } from "next";
import Link from "next/link";
import { StatusLookup } from "./StatusLookup";
import "./status.css";
import { getServerLocale } from "../../i18n/serverLocale";

export function generateMetadata(): Metadata {
  const locale = getServerLocale();
  return locale === "en"
    ? {
        title: "Track request — The Big Tree BJJ",
        description: "Check the status of a request to join the tree."
      }
    : {
        title: "Acompanhar solicitação — The Big Tree BJJ",
        description: "Consulte o andamento de uma solicitação de inclusão na árvore."
      };
}

export default function JoinStatusPage({
  searchParams
}: {
  searchParams: { protocol?: string };
}) {
  const locale = getServerLocale();
  return (
    <main className="status-page">
      <header className="status-header">
        <Link href="/" className="status-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" />
          <span>
            <strong>The Big Tree BJJ</strong>
            <small>Community lineage desk</small>
          </span>
        </Link>
        <Link href="/join">{locale === "en" ? "New request" : "Nova solicitação"}</Link>
      </header>

      <StatusLookup initialProtocol={searchParams.protocol?.trim() ?? ""} locale={locale} />
    </main>
  );
}

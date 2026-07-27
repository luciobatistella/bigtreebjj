import type { Metadata } from "next";
import { LineageEmbed } from "../LineageEmbed";
import type { EmbedLocale, EmbedTheme, EmbedView } from "../embedTypes";
import "../embed.css";

export const metadata: Metadata = {
  title: "Official lineage · The Big Tree BJJ",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

function embedLocale(value?: string): EmbedLocale {
  return value === "en" ? "en" : "pt";
}

function embedTheme(value?: string): EmbedTheme {
  return value === "light" ? "light" : "gold";
}

function embedView(value?: string): EmbedView {
  return value === "compact" || value === "lineage" ? value : "full";
}

export default function EmbeddedLineagePage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams: { lang?: string; theme?: string; view?: string };
}) {
  return (
    <LineageEmbed
      slug={params.slug}
      locale={embedLocale(searchParams.lang)}
      theme={embedTheme(searchParams.theme)}
      view={embedView(searchParams.view)}
    />
  );
}


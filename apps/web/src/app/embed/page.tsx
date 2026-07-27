import type { Metadata } from "next";
import { getServerLocale } from "../i18n/serverLocale";
import { EmbedBuilder } from "./EmbedBuilder";
import "./builder.css";

export const metadata: Metadata = {
  title: "Official lineage widget · The Big Tree BJJ",
  description:
    "Create an official, responsive The Big Tree BJJ lineage widget for any approved public profile."
};

export default function EmbedBuilderPage() {
  return <EmbedBuilder locale={getServerLocale()} />;
}


import type { PublicLineagePortrait } from "../explore/motion/publicLineagePortraits";

export type EmbedLocale = "pt" | "en";
export type EmbedTheme = "gold" | "light";
export type EmbedView = "full" | "lineage" | "compact";

export type EmbedLineagePerson = {
  name: string;
  slug: string;
  relationLabel: string;
};

export type LineageEmbedPayload = {
  version: 1;
  person: {
    name: string;
    slug: string;
    team: string;
    portrait?: PublicLineagePortrait;
  };
  lineage: EmbedLineagePerson[];
  generation: number;
  directBlackBelts: {
    total: number;
    shown: number;
    items: Array<{
      name: string;
      slug: string;
    }>;
  };
  canonicalPath: string;
  limits: {
    maxDirectBlackBelts: number;
    biographiesIncluded: false;
    evidenceDocumentsIncluded: false;
    brandingRequired: true;
  };
};


import type { Locale } from "./locale";

export const profileCopy = {
  pt: {
    selectedAthlete: "Atleta selecionado",
    lineageAncestor: "Ancestral da linhagem",
    discoveryPending: "Registro descoberto aguardando revisão",
    nickname: "Apelido",
    pendingClues: "Indícios de linhagem pendentes",
    noClues: "Nenhum indício de linhagem deste perfil importado está pronto para revisão.",
    confidence: "confiança",
    sourceAttribution: "Atribuição da fonte",
    source: "Fonte",
    use: "Uso",
    specializedSource: "Fonte especializada de descoberta",
    visibility: "Visibilidade",
    openSourceProfile: "Abrir perfil da fonte",
    teamCandidates: "Candidatos de equipe e afiliação",
    personNotFound: "Pessoa não encontrada",
    noLocalRecord: "Nenhum registro local de linhagem corresponde a este endereço.",
    verifiedProfile: "Perfil de linhagem verificado",
    approvedEvidence: "Evidências aprovadas",
    noPublicEvidence: "Sem evidência pública",
    evidenceOnEdge: "evidência no vínculo direto de graduação",
    openSource: "Abrir fonte",
    blackBeltLineage: "Linhagem de faixa-preta",
    generationsShown: (count: number) => `${count} gerações exibidas`,
    directPromotion: "Graduação direta",
    teamContext: "Contexto de equipe",
    lineageRecords: "Registros da linhagem",
    unknownTeacher: "Mestre não informado"
  },
  en: {
    selectedAthlete: "Selected athlete",
    lineageAncestor: "Lineage ancestor",
    discoveryPending: "Discovery record pending review",
    nickname: "Nickname",
    pendingClues: "Pending lineage clues",
    noClues: "No lineage clue from this imported profile is ready for review.",
    confidence: "confidence",
    sourceAttribution: "Source attribution",
    source: "Source",
    use: "Use",
    specializedSource: "Specialized discovery source",
    visibility: "Visibility",
    openSourceProfile: "Open source profile",
    teamCandidates: "Team and affiliation candidates",
    personNotFound: "Person not found",
    noLocalRecord: "No local lineage record matched this address.",
    verifiedProfile: "Verified lineage profile",
    approvedEvidence: "Approved evidence",
    noPublicEvidence: "No public evidence",
    evidenceOnEdge: "evidence on the direct promotion edge",
    openSource: "Open source",
    blackBeltLineage: "Black belt lineage",
    generationsShown: (count: number) => `${count} generations shown`,
    directPromotion: "Direct promotion",
    teamContext: "Team context",
    lineageRecords: "Lineage records",
    unknownTeacher: "Teacher not provided"
  }
} satisfies Record<Locale, object>;

const valueTranslations: Record<string, Record<Locale, string>> = {
  pending: { pt: "pendente", en: "pending" },
  approved: { pt: "aprovado", en: "approved" },
  rejected: { pt: "rejeitado", en: "rejected" },
  verified: { pt: "verificado", en: "verified" },
  public: { pt: "público", en: "public" },
  private: { pt: "privado", en: "private" },
  high: { pt: "alta", en: "high" },
  medium: { pt: "média", en: "medium" },
  low: { pt: "baixa", en: "low" },
  teacher: { pt: "mestre", en: "teacher" },
  black_belt: { pt: "faixa-preta", en: "black belt" },
  team: { pt: "equipe", en: "team" },
  affiliation: { pt: "afiliação", en: "affiliation" },
  "black belt awarded by": { pt: "faixa-preta concedida por", en: "black belt awarded by" },
  "faixa-preta concedida por": { pt: "faixa-preta concedida por", en: "black belt awarded by" },
  "co-awarded black belt": { pt: "faixa-preta concedida em conjunto", en: "co-awarded black belt" },
  "trained under": { pt: "treinou sob orientação de", en: "trained under" },
  pending_review: { pt: "aguardando revisão", en: "pending review" },
  needs_evidence: { pt: "precisa de evidências", en: "needs evidence" }
};

export function translateProfileValue(value: string, locale: Locale) {
  const normalized = value.trim().toLowerCase();
  const direct = valueTranslations[normalized]?.[locale];
  if (direct) return direct;
  return normalized
    .split("_")
    .map((part) => valueTranslations[part]?.[locale] ?? part)
    .join(" ");
}

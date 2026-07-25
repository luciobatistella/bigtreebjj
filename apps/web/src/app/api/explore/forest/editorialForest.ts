import coreData from "../../../big-tree-bjj/conteudo/nucleo.json";
import ptData from "../../../big-tree-bjj/conteudo/pt.json";
import type { Locale } from "../../../i18n/locale";

type Seal = "DOC" | "ATE" | "TRA" | "ESP";

type Biography = {
  nome: string;
  epiteto?: string | null;
  abertura?: string | null;
  formacao?: string | null;
  atuacao?: string | null;
  descendencia?: string | null;
  nota?: string | null;
  lacuna?: string | null;
  apuracao?: string | null;
};

type CanonicalEntity = {
  variantes?: string[];
};

type CanonicalLink = {
  de: string;
  para: string;
  selo: Seal;
  ano?: number | null;
  tipo: string;
  fonte?: string;
};

export type EditorialForestNode = {
  id: string;
  name: string;
  nickname?: string;
  team?: string;
  bio?: string;
  confidence?: string;
  source?: string;
  evidence?: string;
  relationLabel?: string;
  profileHref?: string;
  children?: EditorialForestNode[];
};

const biographies = ptData.verbetes as unknown as Record<string, Biography>;
const people = coreData.pessoas as unknown as Record<string, CanonicalEntity>;
const entities = coreData.entidades as unknown as Record<string, CanonicalEntity>;
const links = coreData.vinculos as unknown as CanonicalLink[];

const collectiveNames: Record<Locale, Record<string, string>> = {
  pt: {
    _marinha_1909: "Marinheiros brasileiros ensinados em 1909",
    _documentario_2020: "Documentário Closed Guard (2020)",
    _choque_craze: "Choque: The Untold Story of Jiu-Jitsu in Brazil"
  },
  en: {
    _marinha_1909: "Brazilian sailors taught in 1909",
    _documentario_2020: "Closed Guard documentary (2020)",
    _choque_craze: "Choque: The Untold Story of Jiu-Jitsu in Brazil"
  }
};

const relationLabels: Record<Locale, Record<string, string>> = {
  pt: {
    formacao: "Formado a partir de",
    graduacao: "Graduado por",
    aluno: "Aluno de",
    aluno_filho: "Aluno e filho de",
    filho_aluno: "Filho e aluno de",
    assistente: "Assistente de",
    reivindicado: "Vínculo reivindicado com",
    fundacao: "Fundado por",
    direcao: "Dirigido por",
    docencia: "Docência registrada com",
    cargo: "Cargo compartilhado com",
    presidencia: "Presidido por",
    arbitragem: "Arbitragem registrada por",
    autoria: "Obra de autoria de",
    relacao_pessoal: "Relação pessoal registrada com",
    aluno_coletivo: "Ensino coletivo conduzido por"
  },
  en: {
    formacao: "Formed from",
    graduacao: "Promoted by",
    aluno: "Student of",
    aluno_filho: "Student and son of",
    filho_aluno: "Son and student of",
    assistente: "Assistant to",
    reivindicado: "Claimed connection with",
    fundacao: "Founded by",
    direcao: "Led by",
    docencia: "Teaching recorded with",
    cargo: "Role shared with",
    presidencia: "Presided over by",
    arbitragem: "Refereeing recorded by",
    autoria: "Work authored by",
    relacao_pessoal: "Recorded personal relationship with",
    aluno_coletivo: "Collective teaching led by"
  }
};

function displayName(id: string, locale: Locale) {
  return (
    biographies[id]?.nome ??
    people[id]?.variantes?.[0] ??
    entities[id]?.variantes?.[0] ??
    collectiveNames[locale][id] ??
    id.replace(/^_+|_+$/g, "").replaceAll("_", " ")
  );
}

function biographyText(id: string) {
  const entry = biographies[id];
  if (!entry) return undefined;

  return [
    entry.abertura,
    entry.formacao,
    entry.atuacao,
    entry.descendencia,
    entry.nota,
    entry.lacuna ? `Lacuna aberta: ${entry.lacuna}` : null,
    entry.apuracao ? `Próxima apuração: ${entry.apuracao}` : null
  ]
    .filter(Boolean)
    .join(" ");
}

function evidenceText(link: CanonicalLink) {
  const parts = [
    `[${link.selo}]`,
    link.tipo.replaceAll("_", " "),
    link.ano ? String(link.ano) : null,
    link.fonte ?? null
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildEditorialForest(locale: Locale = "pt"): EditorialForestNode {
  const linksByOrigin = new Map<string, CanonicalLink[]>();
  const allIds = new Set<string>([
    ...Object.keys(biographies),
    ...links.flatMap((link) => [link.de, link.para])
  ]);
  const idsWithParent = new Set(links.map((link) => link.para));

  links.forEach((link) => {
    const current = linksByOrigin.get(link.de) ?? [];
    current.push(link);
    linksByOrigin.set(link.de, current);
  });

  const roots = [...allIds]
    .filter((id) => !idsWithParent.has(id))
    .sort((a, b) => displayName(a, locale).localeCompare(displayName(b, locale), locale === "en" ? "en-US" : "pt-BR"));

  function projectNode(
    id: string,
    path: string[],
    relation?: CanonicalLink,
    siblingIndex = 0
  ): EditorialForestNode {
    const entry = biographies[id];
    const nodeId = `archive:${[...path, `${id}-${siblingIndex}`].join(":")}`;
    const nextPath = [...path, id];
    const childLinks = (linksByOrigin.get(id) ?? []).filter(
      (link) => !nextPath.includes(link.para)
    );

    return {
      id: nodeId,
      name: displayName(id, locale),
      nickname: entry?.epiteto ?? undefined,
      team: relation
        ? `${locale === "en" ? "Historical archive" : "Acervo histórico"} · ${relation.selo}`
        : locale === "en"
          ? "Independent archive root"
          : "Núcleo independente do acervo",
      bio: biographyText(id),
      confidence: relation?.selo ?? "root",
      source: "editorial_archive",
      evidence: relation
        ? evidenceText(relation)
        : locale === "en"
          ? "Canonical entry · edition 0.2"
          : "Verbete canônico · edição 0.2",
      relationLabel: relation
        ? relationLabels[locale][relation.tipo] ?? (locale === "en" ? "Historical connection with" : "Vínculo histórico com")
        : locale === "en"
          ? "Archive entry root"
          : "Núcleo de entrada do acervo",
      profileHref: entry ? `/#verbete-${id}` : undefined,
      children: childLinks.map((link, index) =>
        projectNode(link.para, nextPath, link, index)
      )
    };
  }

  return {
    id: "archive:root",
    name: locale === "en" ? "Historical archive · edition 0.2" : "Arquivo histórico · edição 0.2",
    team:
      locale === "en"
        ? `${Object.keys(biographies).length} entries · ${links.length} evidence-graded links`
        : `${Object.keys(biographies).length} verbetes · ${links.length} vínculos graduados`,
    bio:
      locale === "en"
        ? "An editorial projection of the historical archive in the Explorer. It complements, without replacing, the trees supplied by PostgreSQL."
        : "Projeção editorial do acervo histórico sobre o Explorer. Ela complementa, sem substituir, as árvores alimentadas pelo PostgreSQL.",
    confidence: "root",
    source: "editorial_archive",
    evidence:
      locale === "en"
        ? "Canonical layer: big-tree-bjj/conteudo/nucleo.json + pt.json"
        : "Camada canônica: big-tree-bjj/conteudo/nucleo.json + pt.json",
    children: roots.map((id, index) => projectNode(id, ["root"], undefined, index))
  };
}

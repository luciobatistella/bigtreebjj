import coreData from "../../../big-tree-bjj/conteudo/nucleo.json";
import { buildEditorialForest, type EditorialForestNode } from "./editorialForest";
import type { Locale } from "../../../i18n/locale";

type RawForestNode = EditorialForestNode & {
  url?: string;
};

type GraphNode = {
  key: string;
  id: string;
  name: string;
  nickname: string;
  team: string;
  url: string;
  bio: string;
  profileHref: string;
  canonical: boolean;
};

type GraphEdge = {
  from: string;
  to: string;
  relationLabel: string;
  evidence: string;
  confidence: string;
  source: string;
  priority: number;
};

export type UnifiedConnection = {
  id: string;
  name: string;
  label: string;
  evidence: string;
  confidence: string;
};

export type UnifiedForestNode = RawForestNode & {
  connections?: UnifiedConnection[];
  children?: UnifiedForestNode[];
};

type CanonicalPerson = {
  variantes?: string[];
};

const people = coreData.pessoas as unknown as Record<string, CanonicalPerson>;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const canonicalAlias = new Map<string, string>();
Object.entries(people).forEach(([id, person]) => {
  (person.variantes ?? []).forEach((name) => canonicalAlias.set(slugify(name), id));
});

function keyForName(name: string) {
  const normalized = slugify(name);
  const canonicalId = canonicalAlias.get(normalized);
  return canonicalId ? `canonical:${canonicalId}` : `name:${normalized}`;
}

function edgePriority(node: RawForestNode) {
  const confidencePriority: Record<string, number> = {
    DOC: 500,
    ATE: 400,
    high: 350,
    medium: 250,
    TRA: 200,
    ESP: 100,
    root: 0
  };
  const relationPriority: Record<string, number> = {
    "Graduado por": 50,
    "Formado a partir de": 45,
    "Aluno de": 40,
    "Aluno e filho de": 40,
    "Filho e aluno de": 40,
    "Dirigido por": 35,
    "Fundado por": 30,
    "Presidido por": 25,
    "Docência registrada com": 20,
    "Cargo compartilhado com": 10
  };

  return (
    (confidencePriority[node.confidence ?? "root"] ?? 0) +
    (relationPriority[node.relationLabel ?? ""] ?? 0)
  );
}

function mergeText(current: string, incoming?: string) {
  const next = incoming?.trim() ?? "";
  if (!next || current.includes(next)) return current;
  return current ? `${current} ${next}` : next;
}

function safePublicUrl(value?: string) {
  const url = value?.trim() ?? "";
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "bjjheroes.com" || hostname.endsWith(".bjjheroes.com")) {
      return "";
    }
    return url;
  } catch {
    return "";
  }
}

const relationTranslations: Record<string, string> = {
  "Faixa-preta concedida por": "Black belt awarded by",
  "Graduado por": "Promoted by",
  "Formado a partir de": "Formed from",
  "Aluno de": "Student of",
  "Aluno e filho de": "Student and son of",
  "Filho e aluno de": "Son and student of",
  "Dirigido por": "Led by",
  "Fundado por": "Founded by",
  "Presidido por": "Presided over by",
  "Docência registrada com": "Teaching recorded with",
  "Cargo compartilhado com": "Role shared with",
  "Núcleo de entrada": "Entry root"
};

function translatedRelation(label: string, locale: Locale) {
  return locale === "en" ? relationTranslations[label] ?? label : label;
}

export function buildUnifiedForest(postgresForest: RawForestNode[], locale: Locale = "pt"): UnifiedForestNode {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  function registerNode(node: RawForestNode, canonical = false) {
    const key = keyForName(node.name);
    const current = nodes.get(key);

    if (!current) {
      nodes.set(key, {
        key,
        id: key,
        name: node.name,
        nickname: node.nickname ?? "",
        team: node.team ?? "",
        url: safePublicUrl(node.url),
        // Textos do PostgreSQL são material interno de descoberta. Somente a
        // prosa canônica entra aqui; os outros perfis recebem uma síntese
        // editorial original e localizada em toTree().
        bio: canonical ? node.bio ?? "" : "",
        profileHref: node.profileHref ?? "",
        canonical
      });
      return key;
    }

    current.canonical ||= canonical;
    current.nickname ||= node.nickname ?? "";
    if (!current.team || current.team.startsWith("Acervo histórico")) {
      current.team = node.team ?? current.team;
    }
    current.url ||= safePublicUrl(node.url);
    current.profileHref ||= node.profileHref ?? "";
    if (canonical) current.bio = mergeText(current.bio, node.bio);
    return key;
  }

  function registerEdge(from: string, to: string, child: RawForestNode) {
    if (from === to) return;
    const edgeKey = `${from}>${to}`;
    const candidate: GraphEdge = {
      from,
      to,
      relationLabel: child.relationLabel ?? "Faixa-preta concedida por",
      evidence: child.evidence ?? "",
      confidence: child.confidence ?? "root",
      source: child.source ?? "root",
      priority: edgePriority(child)
    };
    const current = edges.get(edgeKey);
    if (!current || candidate.priority > current.priority) edges.set(edgeKey, candidate);
  }

  function ingestTree(
    node: RawForestNode,
    parentKey?: string,
    canonical = false
  ) {
    const key = registerNode(node, canonical);
    if (parentKey) registerEdge(parentKey, key, node);
    (node.children ?? []).forEach((child) => ingestTree(child, key, canonical));
  }

  const editorial = buildEditorialForest(locale);
  (editorial.children ?? []).forEach((child) => ingestTree(child, undefined, true));
  postgresForest.forEach((root) => ingestTree(root));

  const incomingCandidates = new Map<string, GraphEdge[]>();
  edges.forEach((edge) => {
    const current = incomingCandidates.get(edge.to) ?? [];
    current.push(edge);
    incomingCandidates.set(edge.to, current);
  });

  const primaryByTarget = new Map<string, GraphEdge>();
  incomingCandidates.forEach((candidates, target) => {
    const [best] = [...candidates].sort(
      (a, b) =>
        b.priority - a.priority ||
        a.from.localeCompare(b.from, "pt-BR")
    );
    if (best) primaryByTarget.set(target, best);
  });

  // Uma escolha local de "melhor pai" pode formar ciclo em dados importados.
  // Quando isso acontece, removemos somente o vínculo de menor confiança do ciclo.
  let cycleRemoved = true;
  while (cycleRemoved) {
    cycleRemoved = false;
    for (const start of nodes.keys()) {
      const seen = new Map<string, number>();
      const chain: string[] = [];
      let current: string | undefined = start;
      while (current && primaryByTarget.has(current)) {
        if (seen.has(current)) {
          const cycle = chain.slice(seen.get(current));
          const weakest = cycle
            .map((target) => primaryByTarget.get(target))
            .filter((edge): edge is GraphEdge => Boolean(edge))
            .sort((a, b) => a.priority - b.priority)[0];
          if (weakest) {
            primaryByTarget.delete(weakest.to);
            cycleRemoved = true;
          }
          break;
        }
        seen.set(current, chain.length);
        chain.push(current);
        current = primaryByTarget.get(current)?.from;
      }
      if (cycleRemoved) break;
    }
  }

  const primaryChildren = new Map<string, GraphEdge[]>();
  primaryByTarget.forEach((edge) => {
    const current = primaryChildren.get(edge.from) ?? [];
    current.push(edge);
    primaryChildren.set(edge.from, current);
  });

  const crossConnections = new Map<string, GraphEdge[]>();
  edges.forEach((edge) => {
    if (primaryByTarget.get(edge.to) === edge) return;
    const current = crossConnections.get(edge.from) ?? [];
    current.push(edge);
    crossConnections.set(edge.from, current);
  });

  const sortByName = (a: GraphEdge, b: GraphEdge) =>
    (nodes.get(a.to)?.name ?? "").localeCompare(nodes.get(b.to)?.name ?? "", "pt-BR");

  function originalBiography(node: GraphNode, incoming?: GraphEdge) {
    if (node.canonical && node.bio.trim()) return node.bio.trim();

    const parent = incoming ? nodes.get(incoming.from) : undefined;
    const relation = incoming
      ? translatedRelation(incoming.relationLabel, locale)
      : locale === "en"
        ? "entry root"
        : "núcleo de entrada";
    const team =
      node.team &&
      !node.team.startsWith("Acervo histórico") &&
      !node.team.startsWith("Historical archive")
        ? node.team
        : "";

    if (locale === "en") {
      const connection = parent
        ? `The primary connection currently recorded links ${node.name} to ${parent.name} under the classification “${relation}”.`
        : `${node.name} is preserved as an entry root while a primary teacher connection is reviewed.`;
      const affiliation = team
        ? `The structured record associates this profile with ${team}.`
        : "No team affiliation is asserted in this public summary.";
      return `${connection} ${affiliation} This original editorial summary uses only structured lineage data held by The Big Tree BJJ; competitive history and personal details remain under independent review.`;
    }

    const connection = parent
      ? `O vínculo principal atualmente registrado conecta ${node.name} a ${parent.name} sob a classificação “${relation}”.`
      : `${node.name} permanece como núcleo de entrada enquanto a conexão com um professor principal é revisada.`;
    const affiliation = team
      ? `O registro estruturado associa este perfil à equipe ${team}.`
      : "Esta síntese pública não afirma vínculo com uma equipe.";
    return `${connection} ${affiliation} Esta síntese editorial original usa apenas os dados estruturados de linhagem mantidos pelo The Big Tree BJJ; trajetória competitiva e dados pessoais permanecem em apuração independente.`;
  }

  function toTree(key: string, incoming?: GraphEdge): UnifiedForestNode {
    const node = nodes.get(key);
    if (!node) throw new Error(`Nó ausente na árvore unificada: ${key}`);

    const connections = (crossConnections.get(key) ?? [])
      .map((edge) => {
        const target = nodes.get(edge.to);
        if (!target) return null;
        return {
          id: target.id,
          name: target.name,
          label: translatedRelation(edge.relationLabel, locale),
          evidence: edge.evidence,
          confidence: edge.confidence
        };
      })
      .filter((connection): connection is UnifiedConnection => Boolean(connection));

    return {
      id: node.id,
      name: node.name,
      nickname: node.nickname,
      team: node.team,
      url: node.url,
      bio: originalBiography(node, incoming),
      profileHref: node.profileHref,
      confidence: incoming?.confidence ?? "root",
      source: node.canonical ? "editorial_archive" : incoming?.source ?? "root",
      evidence: incoming?.evidence ?? "",
      relationLabel: translatedRelation(incoming?.relationLabel ?? "Núcleo de entrada", locale),
      connections: connections.length ? connections : undefined,
      children: (primaryChildren.get(key) ?? [])
        .sort(sortByName)
        .map((edge) => toTree(edge.to, edge))
    };
  }

  const roots = [...nodes.keys()].filter((key) => !primaryByTarget.has(key));
  const containsCanonicalMemo = new Map<string, boolean>();
  function containsCanonical(key: string): boolean {
    const cached = containsCanonicalMemo.get(key);
    if (cached !== undefined) return cached;
    const result =
      Boolean(nodes.get(key)?.canonical) ||
      (primaryChildren.get(key) ?? []).some((edge) => containsCanonical(edge.to));
    containsCanonicalMemo.set(key, result);
    return result;
  }

  const historicalRoots = roots
    .filter(containsCanonical)
    .sort((a, b) => (nodes.get(a)?.name ?? "").localeCompare(nodes.get(b)?.name ?? "", "pt-BR"));
  const unresolvedRoots = roots
    .filter((key) => !containsCanonical(key))
    .sort((a, b) => (nodes.get(a)?.name ?? "").localeCompare(nodes.get(b)?.name ?? "", "pt-BR"));

  const groups: UnifiedForestNode[] = [];
  if (historicalRoots.length) {
    groups.push({
      id: "unified:historical",
      name: "Connected Historical Lineages",
      team:
        locale === "en"
          ? `${historicalRoots.length} origin points`
          : `${historicalRoots.length} pontos de origem`,
      bio:
        locale === "en"
          ? "Roots connected through documented, attested or traditionally claimed links. When multiple teachers are recorded, the strongest evidence link organizes the tree while the others remain as cross-connections."
          : "Núcleos ligados por vínculos documentados, atestados ou tradicionalmente reivindicados. Em caso de múltiplos mestres, o vínculo de evidência mais forte organiza a árvore e os demais permanecem como conexões cruzadas.",
      confidence: "root",
      source: "editorial_archive",
      evidence: locale === "en" ? "Canonical archive + PostgreSQL" : "Acervo canônico + PostgreSQL",
      relationLabel: locale === "en" ? "Historical layer" : "Camada histórica",
      children: historicalRoots.map((key) => toTree(key))
    });
  }
  if (unresolvedRoots.length) {
    groups.push({
      id: "unified:unresolved",
      name: "Unlinked Lineage Roots",
      team:
        locale === "en"
          ? `${unresolvedRoots.length} preserved roots`
          : `${unresolvedRoots.length} núcleos preservados`,
      bio:
        locale === "en"
          ? "PostgreSQL records whose connection to the historical trunks has not yet been demonstrated. They remain visible without inventing a promotion relationship."
          : "Registros presentes no PostgreSQL cuja conexão com os troncos históricos ainda não foi demonstrada. Eles permanecem visíveis sem fabricar uma relação de graduação.",
      confidence: "root",
      source: "manual_audit",
      evidence: locale === "en" ? "Awaiting connection evidence" : "Aguardando evidência de ligação",
      relationLabel: locale === "en" ? "Research grouping" : "Agrupamento de pesquisa",
      children: unresolvedRoots.map((key) => toTree(key))
    });
  }

  return {
    id: "unified:root",
    name: "The Big Tree BJJ · Unified Tree",
    team: locale === "en" ? `${nodes.size} people and entities` : `${nodes.size} pessoas e entidades`,
    bio:
      locale === "en"
        ? "A single navigable projection integrating PostgreSQL lineages with the historical archive. Alternative relationships are preserved as cross-connections and gaps remain explicit."
        : "Uma única projeção navegável que integra as linhagens do PostgreSQL ao arquivo histórico. Relações alternativas são preservadas como conexões cruzadas e lacunas permanecem explícitas.",
    confidence: "root",
    source: "editorial_archive",
    evidence:
      locale === "en"
        ? "103 PostgreSQL roots + canonical historical archive"
        : "103 raízes PostgreSQL + acervo histórico canônico",
    children: groups
  };
}

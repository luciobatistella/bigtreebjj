import Link from "next/link";
import "./home.css";
import { EditorialArchive, type EditorialEntry } from "./EditorialArchive";
import { EditorialMethod } from "./EditorialMethod";
import { EditorialTimeline } from "./EditorialTimeline";
import { HomeMotion } from "./HomeMotion";
import { homeCopy } from "./i18n/homeCopy";
import type { Locale } from "./i18n/locale";
import { getServerLocale } from "./i18n/serverLocale";
import coreData from "./big-tree-bjj/conteudo/nucleo.json";
import ptData from "./big-tree-bjj/conteudo/pt.json";
import enData from "./big-tree-bjj/conteudo/en.json";

type Seal = "DOC" | "ATE" | "TRA" | "ESP";

type CorePerson = {
  variantes?: string[];
  nasc?: string | null;
  morte?: string | null;
  local_nasc?: string | null;
  atuacao_local?: string | null;
  atuacao_periodo?: string | null;
  registro?: string[];
  conflitos?: string[];
  prioridade?: string;
};

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

type EnglishBiography = {
  nome?: string | null;
  epiteto?: string | null;
  corpo?: string | null;
  nota?: string | null;
  lacuna?: string | null;
};

type LinkRecord = {
  de: string;
  para: string;
  selo: Seal;
  ano?: number | null;
  tipo: string;
  fonte?: string;
};

type ConflictRecord = {
  id: string;
  sobre?: string;
  selo_a: Seal;
  selo_b: Seal;
  status: string;
  categoria_conflito?: string;
};

type ConflictCopy = {
  objeto: string;
  a: string;
  b: string | null;
  teste: string;
};

type SourceRecord = {
  veiculo?: string | null;
  data?: string | null;
  pagina?: string | null;
  acervo?: string | null;
  digitalizado?: boolean;
  chapa?: string | null;
  prioridade?: number;
  _nota?: string;
  _nota_apuracao?: string;
};

type FightRecord = {
  id: string;
  data: string;
  a: string;
  b: string;
  contexto?: string;
  resultado: string;
  metodo?: string | null;
  duracao_s?: number | null;
  peso_a_kg?: number | null;
  peso_b_kg?: number | null;
  selo: Seal;
  fonte?: string;
};

type ExternalReference = {
  nome: string;
  tipo: "adversario_externo";
};

const people = coreData.pessoas as Record<string, CorePerson>;
const biographiesPt = ptData.verbetes as Record<string, Biography>;
const biographiesEn = enData.verbetes as Record<string, EnglishBiography>;
const links = coreData.vinculos as LinkRecord[];
const conflicts = coreData.conflitos as ConflictRecord[];
const conflictCopy = ptData.conflitos as Record<string, ConflictCopy>;
const sources = coreData.fontes as Record<string, SourceRecord>;
const externalReferences = coreData.referencias_externas as Record<
  string,
  ExternalReference
>;
const fights = coreData.combates as FightRecord[];

function displayName(id: string) {
  return (
    biographiesPt[id]?.nome ??
    people[id]?.variantes?.[0] ??
    externalReferences[id]?.nome ??
    id.replaceAll("_", " ")
  );
}

function translateRelationshipType(value: string, locale: Locale) {
  if (locale === "pt") return value.replaceAll("_", " ");
  const labels: Record<string, string> = {
    formacao: "training",
    graduacao: "promotion",
    reivindicado: "claimed",
    aluno: "student",
    aluno_coletivo: "collective student group",
    fundacao: "founding",
    direcao: "leadership",
    docencia: "teaching",
    assistente: "assistant instructor",
    relacao_pessoal: "personal relationship",
    filho_aluno: "son and student",
    presidencia: "presidency",
    cargo: "official role",
    aluno_filho: "student and son",
    arbitragem: "refereeing",
    autoria: "authorship",
    filha: "daughter"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function translateConflictCategory(value: string, locale: Locale) {
  if (locale === "pt") return value.replaceAll("_", " ");
  return value === "pos_vinculo" ? "post-relationship" : "origin";
}

function translateStatus(value: string, locale: Locale) {
  if (locale === "pt") return value.replaceAll("_", " ");
  const labels: Record<string, string> = {
    aberto: "open",
    resolvido_provisorio: "provisionally resolved",
    inclinado_para_b: "leaning toward version B"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function translateFightResult(value: string, locale: Locale) {
  if (locale === "pt") return value;
  const labels: Record<string, string> = {
    "domínio": "control",
    "chave de braço": "armbar",
    empate: "draw",
    "estrangulamento pela guarda": "guard choke",
    "ude-garami (chave de braço)": "ude-garami (arm lock)",
    "chute na cabeça (nocaute)": "head kick (knockout)",
    disputado: "contested",
    vitoria_a: "fighter A victory",
    "desistência sob pressão posicional": "submission under positional pressure",
    estrangulamento: "choke",
    "estrangulamento pelas costas": "rear choke"
  };
  return labels[value] ?? value;
}

function formatLife(person: CorePerson | undefined, locale: Locale) {
  if (!person?.nasc && !person?.morte) return undefined;
  return [person.nasc || "?", person.morte || (locale === "en" ? "present" : "presente")].join(" — ");
}

function buildEditorialEntries(locale: Locale): EditorialEntry[] {
  return Object.entries(biographiesPt).map(([id, entry]) => {
    const person = people[id];
    const relationCount = links.filter((link) => link.de === id || link.para === id).length;
    const sourceCount = person?.registro?.length ?? 0;

    if (locale === "en") {
      const translated = biographiesEn[id];
      const name = translated?.nome || entry.nome;
      const teachers = links
        .filter((link) => link.para === id)
        .sort((a, b) => (b.selo === "DOC" ? 4 : b.selo === "ATE" ? 3 : b.selo === "TRA" ? 2 : 1) - (a.selo === "DOC" ? 4 : a.selo === "ATE" ? 3 : a.selo === "TRA" ? 2 : 1));
      const students = links.filter((link) => link.de === id);
      const strongestTeacher = teachers[0];
      const teacherName = strongestTeacher ? displayName(strongestTeacher.de) : "";
      const studentNames = students.slice(0, 5).map((link) => displayName(link.para));
      const structuredOpening = strongestTeacher
        ? `${name} is represented in the historical archive through a recorded connection to ${teacherName}, classified as “${translateRelationshipType(strongestTeacher.tipo, "en")}” with ${strongestTeacher.selo} evidence.`
        : `${name} is preserved as an independent entry in The Big Tree BJJ historical archive while an incoming teacher connection is reviewed.`;

      return {
        id,
        name,
        epithet: translated?.epiteto || entry.epiteto || undefined,
        opening: translated?.corpo || structuredOpening,
        formation: translated?.corpo
          ? undefined
          : strongestTeacher
            ? `The current structured record links this entry to ${teacherName}. It does not reproduce an external biography.`
            : "No teacher is asserted by this concise English edition.",
        activity:
          !translated?.corpo && (person?.atuacao_local || person?.atuacao_periodo)
            ? `Recorded activity: ${[person.atuacao_periodo, person.atuacao_local].filter(Boolean).join(" · ")}.`
            : undefined,
        descendants:
          !translated?.corpo && studentNames.length
            ? `Directly recorded connections include ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(studentNames)}${students.length > studentNames.length ? ` and ${students.length - studentNames.length} more` : ""}.`
            : undefined,
        note:
          translated?.nota ||
          "This original English summary was produced solely from the project’s structured lineage records; no external biographical prose is reproduced.",
        gap:
          translated?.lacuna ||
          "A full independently sourced biography remains under editorial review.",
        research:
          sourceCount
            ? `Review the ${sourceCount} source ${sourceCount === 1 ? "record" : "records"} attached to this entry and replace the concise summary only after independent verification.`
            : "Locate an independent primary or institutional source before expanding this biography.",
        life: formatLife(person, locale),
        location: person?.atuacao_local || person?.local_nasc || undefined,
        priority: person?.prioridade,
        relationCount,
        sourceCount,
        conflictCount: person?.conflitos?.length ?? 0,
        exploreHref: person ? `/explore?search=${encodeURIComponent(name)}` : undefined
      };
    }

    return {
      id,
      name: entry.nome,
      epithet: entry.epiteto || undefined,
      opening: entry.abertura || entry.nota || "Verbete em desenvolvimento editorial.",
      formation: entry.formacao || undefined,
      activity: entry.atuacao || undefined,
      descendants: entry.descendencia || undefined,
      note: entry.nota || undefined,
      gap: entry.lacuna || undefined,
      research: entry.apuracao || undefined,
      life: formatLife(person, locale),
      location: person?.atuacao_local || person?.local_nasc || undefined,
      priority: person?.prioridade,
      relationCount,
      sourceCount,
      conflictCount: person?.conflitos?.length ?? 0,
      exploreHref: person ? `/explore?search=${encodeURIComponent(entry.nome)}` : undefined
    };
  });
}

const lineageLinks = [...links].sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999));

export default function HomePage() {
  const locale = getServerLocale();
  const copy = homeCopy[locale];
  const editorialEntries = buildEditorialEntries(locale);

  return (
    <main className="ed-home">
      <HomeMotion />

      <section className="ed-hero" aria-label="The Big Tree BJJ">
        <video
          className="ed-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/filme-tbt.mp4" type="video/mp4" />
        </video>
        <div className="ed-hero-stage">
          <p className="ed-hero-overline">{copy.hero.overline}</p>
          <div className="ed-hero-emblem">
            <span className="ed-hero-orbit ed-hero-orbit-outer" aria-hidden="true" />
            <span className="ed-hero-orbit ed-hero-orbit-inner" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ed-hero-logo"
              src="/logo.png"
              width="1254"
              height="1254"
              alt="The Big Tree BJJ — The Global Jiu-Jitsu Lineage Database"
            />
          </div>
          <p className="ed-hero-signature">
            <span>{copy.hero.signature[0]}</span>
            <i aria-hidden="true" />
            <span>{copy.hero.signature[1]}</span>
            <i aria-hidden="true" />
            <span>{copy.hero.signature[2]}</span>
          </p>
          <div className="ed-hero-discovery-actions">
            <Link className="ed-hero-discovery-primary" href="/explore">
              {copy.hero.exploreTree}
              <i aria-hidden="true">→</i>
            </Link>
            <a className="ed-hero-discovery-secondary" href="#metodo">
              {copy.hero.discoverHistory}
            </a>
          </div>
        </div>
        <a className="ed-hero-scroll" href="#introducao" aria-label={copy.hero.scrollLabel}>
          <span>{copy.hero.scroll}</span>
          <i aria-hidden="true" />
        </a>
      </section>

      <nav className="ed-index" aria-label={copy.navLabel}>
        <div className="ed-index-track">
          <span className="ed-index-marker" aria-hidden="true">
            <small>INDEX</small>
            <b>00—05</b>
          </span>
          <a className="ed-index-link" href="#metodo">
            <span>01</span>
            <strong>{copy.nav.method}</strong>
          </a>
          <a className="ed-index-link" href="#cronologia">
            <span>02</span>
            <strong>{copy.nav.timeline}</strong>
          </a>
          <a className="ed-index-link" href="#acervo">
            <span>03</span>
            <strong>{copy.nav.entries}</strong>
          </a>
          <a className="ed-index-link" href="#conflitos">
            <span>04</span>
            <strong>{copy.nav.conflicts}</strong>
          </a>
          <a className="ed-index-link" href="#fontes">
            <span>05</span>
            <strong>{copy.nav.sources}</strong>
          </a>
          <Link className="ed-index-explorer" href="/explore">
            <span aria-hidden="true">↗</span>
            <strong>{copy.openExplorer}</strong>
          </Link>
        </div>
      </nav>

      <section className="ed-intro" id="introducao">
        <div className="ed-hero-copy">
          <p className="ed-eyebrow">{copy.intro.eyebrow}</p>
          <h1>
            <span>{copy.intro.title}</span>
            <em>{copy.intro.titleEmphasis}</em>
          </h1>
          <p className="ed-hero-lede">{copy.intro.lede}</p>
          <div className="ed-hero-actions">
            <Link className="ed-button ed-button-primary" href="/explore">
              {copy.intro.explore}
            </Link>
            <a className="ed-button ed-button-ghost" href="#cronologia">
              {copy.intro.history}
            </a>
          </div>
        </div>

        <aside className="ed-hero-thesis">
          <span className="ed-thesis-number">1908</span>
          <p>{copy.intro.thesis}</p>
          <strong>{copy.intro.thesisSource}</strong>
          <Link href="/explore?search=Sada%20Miyako">{copy.intro.thesisLink}</Link>
        </aside>

        <div className="ed-stats" aria-label={copy.intro.statsLabel}>
          <span>
            <strong>{Object.keys(people).length}</strong>
            {copy.intro.stats[0]}
          </span>
          <span>
            <strong>{links.length}</strong>
            {copy.intro.stats[1]}
          </span>
          <span>
            <strong>{editorialEntries.length}</strong>
            {copy.intro.stats[2]}
          </span>
          <span>
            <strong>{conflicts.length}</strong>
            {copy.intro.stats[3]}
          </span>
          <span>
            <strong>{Object.keys(sources).length}</strong>
            {copy.intro.stats[4]}
          </span>
        </div>
      </section>

      <EditorialMethod locale={locale} />

      <section className="ed-section ed-section-dark" id="arvore">
        <div className="ed-section-heading ed-heading-row">
          <div>
            <p className="ed-eyebrow">{copy.tree.eyebrow}</p>
            <h2>{copy.tree.title}</h2>
          </div>
          <Link className="ed-button ed-button-primary" href="/explore">
            {copy.tree.open}
          </Link>
        </div>

        <div className="ed-lineage-ledger">
          {lineageLinks.slice(0, 12).map((link, index) => (
            <Link
              href={`/explore?search=${encodeURIComponent(displayName(link.para))}`}
              className="ed-link-row"
              key={`${link.de}-${link.para}-${index}`}
            >
              <span className={`ed-link-seal ed-link-${link.selo.toLowerCase()}`}>
                {link.selo}
              </span>
              <strong>{displayName(link.de)}</strong>
              <i>→</i>
              <strong>{displayName(link.para)}</strong>
              <small>
                {link.ano || copy.tree.openDate} ·{" "}
                {translateRelationshipType(link.tipo, locale)}
              </small>
            </Link>
          ))}
        </div>

        <details className="ed-all-links">
          <summary>{copy.tree.allLinks(lineageLinks.length)}</summary>
          <div>
            {lineageLinks.map((link, index) => (
              <p key={`${link.de}-${link.para}-all-${index}`}>
                <span>[{link.selo}]</span> {displayName(link.de)} → {displayName(link.para)}
                <small>
                  {link.ano ? ` · ${link.ano}` : ""} ·{" "}
                  {translateRelationshipType(link.tipo, locale)}
                </small>
              </p>
            ))}
          </div>
        </details>
      </section>

      <EditorialTimeline locale={locale} />

      <section className="ed-section ed-section-dark" id="acervo">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.archive.eyebrow}</p>
          <h2>{copy.archive.title}</h2>
          <p>{copy.archive.lede}</p>
        </div>
        <EditorialArchive entries={editorialEntries} locale={locale} />
      </section>

      <section className="ed-section ed-conflicts" id="conflitos">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.conflicts.eyebrow}</p>
          <h2>{copy.conflicts.title}</h2>
          <p>{copy.conflicts.lede}</p>
        </div>
        <div className="ed-conflict-grid">
          {conflicts.map((conflict) => {
            const conflictText = conflictCopy[conflict.id];
            if (!conflictText) return null;
            return (
              <article key={conflict.id}>
                <header>
                  <span>{conflict.id}</span>
                  <small>
                    {translateConflictCategory(
                      conflict.categoria_conflito || copy.conflicts.origin,
                      locale
                    )}{" "}
                    · {translateStatus(conflict.status, locale)}
                  </small>
                </header>
                <h3>{conflictText.objeto}</h3>
                <div>
                  <p>
                    <span>[{conflict.selo_a}]</span>
                    {conflictText.a}
                  </p>
                  <p>
                    <span>[{conflict.selo_b}]</span>
                    {conflictText.b}
                  </p>
                </div>
                <footer>
                  <strong>{copy.conflicts.test}</strong>
                  {conflictText.teste}
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ed-section ed-section-dark" id="combates">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.fights.eyebrow}</p>
          <h2>{copy.fights.title}</h2>
          <p>{copy.fights.lede}</p>
        </div>
        <div className="ed-fight-list">
          {fights.map((fight) => (
            <article key={fight.id}>
              <time>{fight.data}</time>
              <div>
                <strong>{displayName(fight.a)}</strong>
                <span>×</span>
                <strong>{displayName(fight.b)}</strong>
              </div>
              <p>
                {translateFightResult(
                  fight.metodo || fight.resultado.replaceAll("_", " "),
                  locale
                )}
                {fight.duracao_s ? ` · ${fight.duracao_s}s` : ""}
              </p>
              <span className={`ed-link-seal ed-link-${fight.selo.toLowerCase()}`}>
                {fight.selo}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="ed-section ed-sources" id="fontes">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.sources.eyebrow}</p>
          <h2>{copy.sources.title}</h2>
          <p>{copy.sources.lede}</p>
        </div>
        <div className="ed-source-grid">
          {Object.entries(sources).map(([id, source]) => (
            <article key={id}>
              <header>
                <span>{id}</span>
                <small>{source.digitalizado ? copy.sources.digitized : copy.sources.locate}</small>
              </header>
              <h3>{source.veiculo || copy.sources.unidentified}</h3>
              <p>
                {[source.data, source.pagina ? `p. ${source.pagina}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <strong>{source.acervo || copy.sources.archivePending}</strong>
              {source._nota || source._nota_apuracao ? (
                <small>{source._nota || source._nota_apuracao}</small>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="ed-historiography">
        <p className="ed-eyebrow">{copy.historiography.eyebrow}</p>
        <h2>{copy.historiography.title}</h2>
        <p>{copy.historiography.lede}</p>
        <div>
          {copy.historiography.voices.map(([name, description]) => (
            <article key={name}>
              <strong>{name}</strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
        <aside className="ed-editorial-note">
          <span>{locale === "pt" ? "Declaração editorial" : "Editorial statement"}</span>
          <p>
            {locale === "pt"
              ? "A aparência de rigor não substitui a verificação. Onde o acervo ainda não foi consultado, a limitação permanece publicada — junto da pergunta e do lugar onde ela pode ser resolvida."
              : "The appearance of rigor does not replace verification. Where an archive has not yet been consulted, that limit remains published — alongside the question and the place where it can be resolved."}
          </p>
        </aside>
      </section>

      <section className="ed-join-invitation" aria-labelledby="join-invitation-title">
        <div>
          <p className="ed-eyebrow">{copy.join.eyebrow}</p>
          <h2 id="join-invitation-title">{copy.join.title}</h2>
          <p>{copy.join.lede}</p>
        </div>
        <Link className="ed-hero-join" href="/join">
          <span>{copy.join.actionEyebrow}</span>
          <strong>{copy.join.action}</strong>
          <i aria-hidden="true">→</i>
        </Link>
      </section>

      <footer className="ed-footer">
        <div>
          <strong>The Big Tree BJJ</strong>
          <p>{copy.footer.lede}</p>
        </div>
        <nav>
          <Link href="/explore">Explorer</Link>
          <a href="#metodo">{copy.footer.method}</a>
          <a href="#acervo">{copy.footer.archive}</a>
          <a href="#fontes">{copy.footer.sources}</a>
        </nav>
        <small>{copy.footer.version(coreData._versao)}</small>
      </footer>
    </main>
  );
}

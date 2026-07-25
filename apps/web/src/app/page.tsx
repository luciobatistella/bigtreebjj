import Link from "next/link";
import "./home.css";
import { EditorialArchive, type EditorialEntry } from "./EditorialArchive";
import { HomeMotion } from "./HomeMotion";
import { homeCopy, timelineEn } from "./i18n/homeCopy";
import type { Locale } from "./i18n/locale";
import { getServerLocale } from "./i18n/serverLocale";
import coreData from "./big-tree-bjj/conteudo/nucleo.json";
import ptData from "./big-tree-bjj/conteudo/pt.json";

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

const people = coreData.pessoas as Record<string, CorePerson>;
const biographies = ptData.verbetes as Record<string, Biography>;
const links = coreData.vinculos as LinkRecord[];
const conflicts = coreData.conflitos as ConflictRecord[];
const conflictCopy = ptData.conflitos as Record<string, ConflictCopy>;
const sources = coreData.fontes as Record<string, SourceRecord>;
const fights = coreData.combates as FightRecord[];

const timelinePt = [
  {
    date: "1333–1573",
    title: "Antes do jūjutsu",
    text: "Sistemas de campo de batalha hoje agrupados como koryū jūjutsu operavam com armas, armaduras e agarramento — não como uma arte desarmada única."
  },
  {
    date: "c. 1640",
    title: "Sekiguchi-ryū",
    text: "A escola reúne jūjutsu, kenjutsu e iaijutsu; a primeira atestação datada do termo continua sendo uma lacuna central."
  },
  {
    date: "1882",
    title: "Fundação do Kodokan",
    text: "Jigoro Kano reorganiza um corpo técnico anterior como projeto pedagógico e institucional."
  },
  {
    date: "1908",
    title: "Miyako e Kakihara chegam ao Rio",
    text: "A Gazeta de Notícias registra os dois professores contratados para instruir marinheiros brasileiros — seis anos antes de Maeda."
  },
  {
    date: "1909",
    title: "Brasileiros ensinam brasileiros",
    text: "Marinheiros já formados seguem para a Bahia. A primeira transmissão nacional conhecida é militar e pública."
  },
  {
    date: "1913",
    title: "O clube de Mário Aleixo",
    text: "Surge o que fontes descrevem como o primeiro clube de jiu-jitsu do Brasil, ainda antes da chegada de Maeda."
  },
  {
    date: "1914",
    title: "Maeda desembarca no Pará",
    text: "Conde Koma se vincula ao projeto de colônia japonesa e se fixa em Belém; a data exata ainda é objeto de conflito."
  },
  {
    date: "1920",
    title: "Os cinco primeiros galões",
    text: "Maeda promove Jacyntho Ferro, Waldemar Lopes, Raphael Gomes, Guilherme DelaRocque e Matheus Pereira."
  },
  {
    date: "1921",
    title: "A peça que muda a linhagem",
    text: "A imprensa identifica Donato Pires e Carlos Gracie como alunos de Jacyntho Ferro, não diretamente de Maeda."
  },
  {
    date: "1930",
    title: "Academia da Marques de Abrantes",
    text: "Donato dirige a primeira academia documentada; Carlos e George Gracie integram o corpo docente."
  },
  {
    date: "1942–1951",
    title: "França, Fadda e a linhagem suburbana",
    text: "Fadda recebe o grau de instrutor, abre academia e sua equipe desafia a Academia Gracie com forte uso de chaves de pé."
  },
  {
    date: "1967",
    title: "A federação da Guanabara",
    text: "A institucionalização reúne escolas e transforma regras, cargos e faixas em registro administrativo."
  },
  {
    date: "1993",
    title: "O UFC e a diáspora global",
    text: "A vitória de Royce Gracie projeta o jiu-jitsu brasileiro para um público mundial e altera a história das lutas."
  }
];

function displayName(id: string) {
  return biographies[id]?.nome ?? people[id]?.variantes?.[0] ?? id.replaceAll("_", " ");
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

function formatLife(person?: CorePerson) {
  if (!person?.nasc && !person?.morte) return undefined;
  return [person.nasc || "?", person.morte || "presente"].join(" — ");
}

const editorialEntries: EditorialEntry[] = Object.entries(biographies).map(([id, entry]) => {
  const person = people[id];
  const relationCount = links.filter((link) => link.de === id || link.para === id).length;
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
    life: formatLife(person),
    location: person?.atuacao_local || person?.local_nasc || undefined,
    priority: person?.prioridade,
    relationCount,
    sourceCount: person?.registro?.length ?? 0,
    conflictCount: person?.conflitos?.length ?? 0,
    exploreHref: person ? `/explore?search=${encodeURIComponent(entry.nome)}` : undefined
  };
});

const lineageLinks = [...links].sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999));

export default function HomePage() {
  const locale = getServerLocale();
  const copy = homeCopy[locale];
  const sealCopy = copy.method.seals;
  const timeline = locale === "en" ? timelineEn : timelinePt;

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
          <Link className="ed-hero-join" href="/join">
            <span>{copy.hero.joinEyebrow}</span>
            <strong>{copy.hero.joinTitle}</strong>
            <i aria-hidden="true">→</i>
          </Link>
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
          <div className="ed-hero-belt" aria-hidden="true">
            <span />
            <b>
              <i />
              <i />
              <i />
              <i />
            </b>
          </div>
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

      <section className="ed-section ed-method" id="metodo">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.method.eyebrow}</p>
          <h2>{copy.method.title}</h2>
          <p>{copy.method.lede}</p>
        </div>
        <div className="ed-seal-grid">
          {(Object.entries(sealCopy) as Array<[Seal, (typeof sealCopy)[Seal]]>).map(
            ([seal, copy]) => (
              <article className={`ed-seal ed-seal-${seal.toLowerCase()}`} key={seal}>
                <span>[{seal}]</span>
                <h3>{copy.label}</h3>
                <p>{copy.description}</p>
              </article>
            )
          )}
        </div>
        <div className="ed-method-rules">
          {copy.method.rules.map(([title, description]) => (
            <p key={title}>
              <strong>{title}</strong> {description}
            </p>
          ))}
        </div>
      </section>

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

      <section className="ed-section ed-timeline-section" id="cronologia">
        <div className="ed-section-heading">
          <p className="ed-eyebrow">{copy.timeline.eyebrow}</p>
          <h2>{copy.timeline.title}</h2>
          <p>{copy.timeline.lede}</p>
        </div>
        <div className="ed-timeline">
          {timeline.map((event, index) => (
            <article key={event.date}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <time>{event.date}</time>
              <div>
                <h3>{event.title}</h3>
                <p>{event.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

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

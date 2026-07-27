import type { Locale } from "./locale";

export const homeCopy = {
  pt: {
    brandSubtitle: "História, fonte e linhagem",
    navLabel: "Navegação principal",
    nav: {
      method: "Método",
      timeline: "Cronologia",
      entries: "Verbetes",
      conflicts: "Conflitos",
      sources: "Fontes"
    },
    openExplorer: "Abrir Explorer",
    hero: {
      exploreTree: "Explorar a árvore viva",
      discoverHistory: "Conhecer a história",
      overline: "The global jiu-jitsu lineage database",
      signature: ["História", "Fonte", "Linhagem"],
      scrollLabel: "Continuar para a introdução",
      scroll: "Conheça o projeto"
    },
    join: {
      eyebrow: "A história continua",
      title: "É faixa-preta e não encontrou seu nome na árvore?",
      lede:
        "Sua trajetória pode se tornar parte desta obra. Envie sua documentação para análise editorial e ajude a manter a linhagem viva, verificável e aberta.",
      actionEyebrow: "Solicitação de inclusão",
      action: "Quero registrar minha linhagem"
    },
    intro: {
      eyebrow: "Obra de referência · edição viva 0.2",
      title: "A história inteira.",
      titleEmphasis: "A árvore aberta.",
      lede:
        "Do primeiro registro japonês aos tatames de hoje. Cada vínculo carrega seu próprio grau de prova — e cada lacuna permanece visível até que um documento novo a feche.",
      explore: "Explorar a árvore viva",
      history: "Começar pela história",
      thesis: "A entrada documentada do jiu-jitsu no Brasil antecede Maeda em seis anos.",
      thesisSource: "Gazeta de Notícias · 17 dez. 1908 · p. 4",
      thesisLink: "Abrir Sada Miyako no Explorer →",
      statsLabel: "Dimensão do acervo",
      stats: [
        "pessoas pesquisadas",
        "vínculos classificados",
        "verbetes publicados",
        "conflitos abertos",
        "fontes catalogadas"
      ]
    },
    method: {
      eyebrow: "01 · Regra da casa",
      title: "Toda afirmação usa faixa.",
      lede:
        "A obra não escolhe uma tradição vencedora. Ela classifica o lastro de cada versão, coloca concorrentes lado a lado e deixa o leitor enxergar onde termina o documento e começa a memória.",
      seals: {
        DOC: {
          label: "Documentado",
          description:
            "Fonte primária localizável: jornal, registro, ata, contrato ou documento oficial."
        },
        ATE: {
          label: "Atestado",
          description:
            "Testemunho de contemporâneo ou memória publicada, ainda sem documento confirmatório."
        },
        TRA: {
          label: "Tradicional",
          description:
            "Narrativa consolidada por família, academia ou linhagem, sem base primária identificada."
        },
        ESP: {
          label: "Especulativo",
          description:
            "Inferência moderna construída a partir de evidências indiretas e explicitamente atribuída."
        }
      },
      rules: [
        ["Regra de rebaixamento.", "Na dúvida entre dois selos, usa-se o mais fraco."],
        [
          "Regra de não-promoção.",
          "Repetição não transforma tradição em documento."
        ],
        [
          "Regra da lacuna.",
          "Onde não há fonte, a pergunta em aberto vira parte publicada da obra."
        ]
      ]
    },
    tree: {
      eyebrow: "02 · A árvore, vínculo por vínculo",
      title: "A pessoa não recebe selo. A ligação recebe.",
      open: "Navegar no Explorer",
      openDate: "data aberta",
      allLinks: (count: number) => `Ver os ${count} vínculos editoriais`
    },
    timeline: {
      eyebrow: "03 · Cronologia mestra",
      title: "Do campo de batalha à diáspora global.",
      lede:
        "A cronologia não é decoração: ela impede que narrativas posteriores ocupem o lugar de acontecimentos anteriores já documentados."
    },
    archive: {
      eyebrow: "04 · Acervo biográfico completo",
      title: "Quarenta e seis portas para a árvore.",
      lede:
        "Pessoas, instituições e acontecimentos são publicados com formação, atuação, descendência, notas editoriais, lacunas e fila de apuração. Quando há pessoa correspondente no banco, o verbete abre diretamente o Explorer."
    },
    conflicts: {
      eyebrow: "05 · Registro aberto",
      title: "O que ainda não sabemos.",
      lede:
        "Um conflito só fecha com documento novo — nunca por peso de tradição ou argumento de autoridade.",
      origin: "origem",
      test: "Teste que resolve"
    },
    fights: {
      eyebrow: "06 · Combates documentados",
      title: "O ringue também é documento.",
      lede:
        "Onze combates estão estruturados por data, protagonistas, resultado, método, duração e fonte."
    },
    sources: {
      eyebrow: "07 · Fontes e acervos",
      title: "A história precisa apontar a estante.",
      lede:
        "Veículo, data, página e acervo permanecem visíveis. Uma referência incompleta não é escondida: ela entra na fila de apuração.",
      digitized: "digitalizado",
      locate: "a localizar",
      unidentified: "Fonte primária ainda não identificada",
      archivePending: "Acervo em apuração"
    },
    historiography: {
      eyebrow: "Livro VII · Historiografia",
      title: "Ninguém aqui é neutro. Nem esta obra.",
      lede:
        "Reila Gracie escreve a memória de dentro; Roberto Pedreira assume o revisionismo; Robert Drysdale leva a experiência de competidor para a investigação histórica. A base registra o interesse de cada voz — e aplica a mesma régua crítica a si própria.",
      voices: [
        ["Reila Gracie", "A memória familiar e o acesso aos protagonistas."],
        ["Roberto Pedreira", "A revisão explícita das narrativas consagradas."],
        ["Robert Drysdale", "O competidor que transformou experiência em pesquisa."]
      ]
    },
    footer: {
      lede: "História documentada, árvore navegável e lacunas abertas.",
      method: "Método",
      archive: "Acervo",
      sources: "Fontes",
      version: (version: string) =>
        `Base editorial v${version} · conteúdo canônico em português`
    }
  },
  en: {
    brandSubtitle: "History, sources and lineage",
    navLabel: "Main navigation",
    nav: {
      method: "Method",
      timeline: "Timeline",
      entries: "Entries",
      conflicts: "Conflicts",
      sources: "Sources"
    },
    openExplorer: "Open Explorer",
    hero: {
      exploreTree: "Explore the living tree",
      discoverHistory: "Discover the history",
      overline: "The global jiu-jitsu lineage database",
      signature: ["History", "Sources", "Lineage"],
      scrollLabel: "Continue to the introduction",
      scroll: "Discover the project"
    },
    join: {
      eyebrow: "The story continues",
      title: "A black belt and not yet in the tree?",
      lede:
        "Your journey can become part of this work. Submit your documentation for editorial review and help keep the lineage alive, verifiable and open.",
      actionEyebrow: "Inclusion request",
      action: "Register my lineage"
    },
    intro: {
      eyebrow: "Reference work · living edition 0.2",
      title: "The whole history.",
      titleEmphasis: "The open tree.",
      lede:
        "From the earliest Japanese record to today's mats. Every link carries its own grade of proof — and every gap remains visible until a new document closes it.",
      explore: "Explore the living tree",
      history: "Start with the history",
      thesis:
        "The documented arrival of jiu-jitsu in Brazil predates Maeda by six years.",
      thesisSource: "Gazeta de Notícias · Dec 17, 1908 · p. 4",
      thesisLink: "Open Sada Miyako in the Explorer →",
      statsLabel: "Archive scope",
      stats: [
        "people researched",
        "links classified",
        "entries published",
        "open conflicts",
        "sources catalogued"
      ]
    },
    method: {
      eyebrow: "01 · House rule",
      title: "Every claim wears a belt.",
      lede:
        "This work does not choose a winning tradition. It grades the support behind each version, places competing accounts side by side, and lets the reader see where documents end and memory begins.",
      seals: {
        DOC: {
          label: "Documented",
          description:
            "A locatable primary source: period newspaper, registry, minutes, contract or official document."
        },
        ATE: {
          label: "Attested",
          description:
            "Testimony from a contemporary or a published memoir, without a confirming document."
        },
        TRA: {
          label: "Traditional",
          description:
            "A narrative established by a family, academy or lineage, with no identified primary basis."
        },
        ESP: {
          label: "Speculative",
          description:
            "A modern inference built from indirect evidence and explicitly attributed."
        }
      },
      rules: [
        ["Downgrade rule.", "When in doubt between two grades, use the weaker one."],
        ["No-promotion rule.", "Repetition does not turn tradition into documentation."],
        [
          "Open-gap rule.",
          "Where no source exists, the open question becomes a published part of the work."
        ]
      ]
    },
    tree: {
      eyebrow: "02 · The tree, link by link",
      title: "The person is not graded. The link is.",
      open: "Browse the Explorer",
      openDate: "open date",
      allLinks: (count: number) => `View all ${count} editorial links`
    },
    timeline: {
      eyebrow: "03 · Master timeline",
      title: "From the battlefield to the global diaspora.",
      lede:
        "The timeline is not decoration: it prevents later narratives from taking the place of earlier events already supported by documents."
    },
    archive: {
      eyebrow: "04 · Complete biographical archive",
      title: "Forty-six doors into the tree.",
      lede:
        "People, institutions and events are published with training, activity, descendants, editorial notes, open gaps and research queues. When a matching database person exists, the entry opens directly in the Explorer."
    },
    conflicts: {
      eyebrow: "05 · Open ledger",
      title: "What we still do not know.",
      lede:
        "A conflict closes only with a new document — never through the weight of tradition or an appeal to authority.",
      origin: "origin",
      test: "Test that would settle it"
    },
    fights: {
      eyebrow: "06 · Documented bouts",
      title: "The ring is also a document.",
      lede:
        "Eleven bouts are structured by date, participants, result, method, duration and source."
    },
    sources: {
      eyebrow: "07 · Sources and archives",
      title: "History must point to the shelf.",
      lede:
        "Publication, date, page and archive remain visible. An incomplete reference is not hidden: it enters the research queue.",
      digitized: "digitized",
      locate: "to be located",
      unidentified: "Primary source not yet identified",
      archivePending: "Archive under investigation"
    },
    historiography: {
      eyebrow: "Book VII · Historiography",
      title: "No one here is neutral. Neither is this work.",
      lede:
        "Reila Gracie writes family memory from within; Roberto Pedreira openly embraces revisionism; Robert Drysdale brings a competitor's experience to historical investigation. The database records each voice's interests — and applies the same critical standard to itself.",
      voices: [
        ["Reila Gracie", "Family memory and access to the central figures."],
        ["Roberto Pedreira", "An explicit revision of established narratives."],
        ["Robert Drysdale", "The competitor who turned experience into research."]
      ]
    },
    footer: {
      lede: "Documented history, a navigable tree and open research gaps.",
      method: "Method",
      archive: "Archive",
      sources: "Sources",
      version: (version: string) =>
        `Editorial database v${version} · canonical content in Portuguese`
    }
  }
} satisfies Record<Locale, unknown>;

export const timelineEn = [
  {
    date: "1333–1573",
    title: "Before jūjutsu",
    text:
      "Battlefield systems now grouped under koryū jūjutsu combined weapons, armour and grappling — not a single unarmed art."
  },
  {
    date: "c. 1640",
    title: "Sekiguchi-ryū",
    text:
      "The school brought together jūjutsu, kenjutsu and iaijutsu; the earliest dated attestation of the term remains a central open gap."
  },
  {
    date: "1882",
    title: "The Kodokan is founded",
    text:
      "Jigoro Kano reorganised an earlier technical body into a pedagogical and institutional project."
  },
  {
    date: "1908",
    title: "Miyako and Kakihara arrive in Rio",
    text:
      "Gazeta de Notícias recorded the two teachers hired to instruct Brazilian sailors — six years before Maeda."
  },
  {
    date: "1909",
    title: "Brazilians teach Brazilians",
    text:
      "Already-trained sailors travelled to Bahia. The earliest known national transmission was military and public."
  },
  {
    date: "1913",
    title: "Mário Aleixo's club",
    text:
      "What sources describe as Brazil's first jiu-jitsu club emerged before Maeda arrived."
  },
  {
    date: "1914",
    title: "Maeda lands in Pará",
    text:
      "Conde Koma joined the Japanese colony project and settled in Belém; the exact date remains disputed."
  },
  {
    date: "1920",
    title: "The first five stripes",
    text:
      "Maeda promoted Jacyntho Ferro, Waldemar Lopes, Raphael Gomes, Guilherme DelaRocque and Matheus Pereira."
  },
  {
    date: "1921",
    title: "The document that changes the lineage",
    text:
      "The press identified Donato Pires and Carlos Gracie as Jacyntho Ferro's students, not Maeda's direct students."
  },
  {
    date: "1930",
    title: "The Marques de Abrantes academy",
    text:
      "Donato directed the first documented academy; Carlos and George Gracie were part of its teaching staff."
  },
  {
    date: "1942–1951",
    title: "França, Fadda and the suburban lineage",
    text:
      "Fadda received his instructor grade, opened an academy, and his team challenged the Gracie Academy with extensive use of footlocks."
  },
  {
    date: "1967",
    title: "The Guanabara federation",
    text:
      "Institutionalisation brought schools together and turned rules, offices and belts into administrative records."
  },
  {
    date: "1993",
    title: "The UFC and the global diaspora",
    text:
      "Royce Gracie's victory introduced Brazilian jiu-jitsu to a global audience and changed combat-sports history."
  }
];

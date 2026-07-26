import type { Locale } from "./locale";

function englishOrdinal(value: number) {
  const mod100 = value % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

export const explorerCopy = {
  pt: {
    apiStatusError: (status: number) => `Erro ${status} ao carregar linhagens.`,
    timeoutError: "A API demorou mais de 15 segundos para responder.",
    unknownError: "Falha desconhecida ao carregar as linhagens.",
    emptyError: "Nenhuma linhagem conectada foi encontrada.",
    branchPeople: (count: string) => `${count} pessoas neste ramo`,
    selectedPerson: "Pessoa selecionada",
    requestConnection: (name: string) => `Solicitar inclusão como conexão de ${name}`,
    openDetailsFor: (name: string) => `Abrir detalhes de ${name}`,
    root: "Raiz",
    treeOverview: "Visão geral da árvore",
    tapToOpen: (count: string) => `Toque para abrir ${count} conexões`,
    editorialArchive: "Acervo editorial",
    historicalCuration: "Curadoria histórica",
    manualAudit: "Auditoria manual",
    bioHigh: "Extraída da bio · alta",
    bioMedium: "Extraída da bio · média",
    lineageRoot: "Raiz da linhagem",
    directConnections: (count: number) =>
      `${count === 1 ? "conexão direta registrada" : "conexões diretas registradas"}`,
    blackBeltsAwarded: (count: number) =>
      `${count === 1 ? "faixa-preta formado registrado" : "faixas-pretas formados registrados"}`,
    collapseBranch: "Recolher ramo",
    exploreBranch: "Explorar ramo",
    connectedPeople: (count: string, singular: boolean) =>
      `${count} ${singular ? "pessoa conectada" : "pessoas conectadas"}`,
    belongsToBranch: "Meu nome pertence a este ramo",
    nextConnections: "Próximas conexões",
    moreConnections: (count: number) => `+${count} conexões neste ramo`,
    awardedBy: "Faixa-preta concedida por",
    lineage: "Linhagem",
    otherConnections: "Outras conexões preservadas",
    about: "Sobre",
    historicalContentNotice: "",
    readHistoricalEntry: "Ler verbete histórico",
    viewFullProfile: "Ver perfil completo",
    playLineageStory: "Celebrar esta linhagem",
    generation: (current: number, total: number) => `geração ${current} de ${total}`,
    lineageRecognition: "Linhagem reconhecida",
    lineageGenerationBadge: (count: number) => String(count).padStart(2, "0"),
    lineageGenerationLabel: "Geração",
    lineageCrestSeal: "Faixa preta",
    lineageCelebrationLead: () => "Faixa preta de jiu-jitsu",
    lineageStoryLabel: "A história desta linhagem",
    lineageStory: ({
      origin,
      institution,
      traveler,
      bridge,
      brazilRoot,
      guardians,
      honoree,
      generation
    }: {
      origin: string;
      institution: string;
      traveler: string;
      bridge: string;
      brazilRoot: string;
      guardians: string;
      honoree: string;
      generation: number;
    }) => [
      {
        eyebrow: "Capítulo 01 · A origem",
        title: "Antes da árvore, existiu uma decisão.",
        body: `${origin} transformou conhecimento em método. No ${institution}, a técnica ganhou disciplina, memória e futuro.`
      },
      {
        eyebrow: "Capítulo 02 · A travessia",
        title: "O conhecimento atravessou o oceano.",
        body: `${traveler} levou essa herança ao Brasil. Com ${bridge} e ${brazilRoot}, ela encontrou novas mãos — e uma nova história.`
      },
      {
        eyebrow: "Capítulo 03 · Os guardiões",
        title: "Nenhuma geração chegou aqui por acaso.",
        body: `O elo permaneceu vivo com ${guardians}: conhecimento aprendido, provado e transmitido. Cada faixa preta tornou-se responsável pela próxima.`
      },
      {
        eyebrow: "Capítulo 04 · O seu nome",
        title: `Hoje, a história chega a ${honoree}.`,
        body: `Você não é apenas um nome na árvore. É a ${generation}ª geração de faixa preta de jiu-jitsu — e um novo ponto de partida para quem vier depois.`
      }
    ],
    lineageCelebrationClosing: (name: string) =>
      `Esta linhagem chegou a ${name}. Agora, os próximos nomes podem continuar a árvore.`,
    lineageContinues: "A árvore continua",
    lineageJoinQuestion: (name: string) => `Você recebeu sua faixa preta de ${name}?`,
    lineageJoinBody:
      "Seu nome pode ser o próximo elo. Envie seus certificados e solicite sua inclusão nesta história.",
    lineageJoinAction: "Adicionar meu nome à árvore",
    lineageLegacy: "Legado preservado",
    youAreHere: "Seu lugar na história",
    lineageSwipeHint: "Deslize para ver toda a linhagem →",
    copyDirectLineageLink: "Copiar meu link direto",
    directLinkCopied: "Link direto copiado!",
    exitLineageCelebration: "Voltar à árvore",
    linkCopied: "Link copiado!",
    unifiedTree: "Árvore unificada",
    resultLineage: "linhagem",
    noResults: "Nenhum resultado",
    chooseLineage: "Escolher linhagem",
    searchPlaceholder: "Buscar em todas as linhagens...",
    searchAria: "Buscar pessoa em todas as linhagens",
    close: "Fechar",
    overview: "Visão geral",
    legend: "Legenda",
    bioExtracted: "Extraída da bio",
    partialName: "Nome parcial",
    desktopHint:
      "Arraste para navegar · clique no nó para abrir o ramo · use a roda para zoom · pressione / para buscar",
    mobileHint: "Toque no nó para abrir · arraste para navegar · use dois dedos para zoom",
    treeNavigation: "Navegação da árvore",
    backToTeacher: "Voltar ao mestre (↑)",
    back: "Voltar",
    goToRoot: "Ir à raiz (Home)",
    fitSelection: "Enquadrar seleção (F)",
    fit: "Enquadrar",
    enter: "Entrar",
    details: "Detalhes",
    zoomControls: "Controles de zoom",
    help: "Ajuda",
    zoomOut: "Diminuir zoom",
    zoomIn: "Aumentar zoom",
    lineagePath: "Caminho da linhagem",
    share: "Compartilhar",
    loading: "Carregando linhagens…",
    loadFailed: "Não foi possível carregar as linhagens.",
    retry: "Tentar novamente"
  },
  en: {
    apiStatusError: (status: number) => `Error ${status} while loading lineages.`,
    timeoutError: "The API took more than 15 seconds to respond.",
    unknownError: "Unknown error while loading the lineages.",
    emptyError: "No connected lineage was found.",
    branchPeople: (count: string) => `${count} people in this branch`,
    selectedPerson: "Selected person",
    requestConnection: (name: string) => `Request inclusion as a connection of ${name}`,
    openDetailsFor: (name: string) => `Open details for ${name}`,
    root: "Root",
    treeOverview: "Tree overview",
    tapToOpen: (count: string) => `Tap to open ${count} connections`,
    editorialArchive: "Editorial archive",
    historicalCuration: "Historical curation",
    manualAudit: "Manual audit",
    bioHigh: "Extracted from bio · high",
    bioMedium: "Extracted from bio · medium",
    lineageRoot: "Lineage root",
    directConnections: (count: number) =>
      `${count === 1 ? "direct connection recorded" : "direct connections recorded"}`,
    blackBeltsAwarded: (count: number) =>
      `${count === 1 ? "recorded black belt awarded" : "recorded black belts awarded"}`,
    collapseBranch: "Collapse branch",
    exploreBranch: "Explore branch",
    connectedPeople: (count: string, singular: boolean) =>
      `${count} ${singular ? "person connected" : "people connected"}`,
    belongsToBranch: "My name belongs in this branch",
    nextConnections: "Next connections",
    moreConnections: (count: number) => `+${count} connections in this branch`,
    awardedBy: "Black belt awarded by",
    lineage: "Lineage",
    otherConnections: "Other preserved connections",
    about: "About",
    historicalContentNotice:
      "Historical text shown in canonical Portuguese; reviewed English edition pending.",
    readHistoricalEntry: "Read historical entry",
    viewFullProfile: "View full profile",
    playLineageStory: "Celebrate this lineage",
    generation: (current: number, total: number) => `generation ${current} of ${total}`,
    lineageRecognition: "Lineage recognized",
    lineageGenerationBadge: (count: number) => String(count).padStart(2, "0"),
    lineageGenerationLabel: "Generation",
    lineageCrestSeal: "Black belt",
    lineageCelebrationLead: () => "Brazilian jiu-jitsu black belt",
    lineageStoryLabel: "The story of this lineage",
    lineageStory: ({
      origin,
      institution,
      traveler,
      bridge,
      brazilRoot,
      guardians,
      honoree,
      generation
    }: {
      origin: string;
      institution: string;
      traveler: string;
      bridge: string;
      brazilRoot: string;
      guardians: string;
      honoree: string;
      generation: number;
    }) => [
      {
        eyebrow: "Chapter 01 · The origin",
        title: "Before the tree, there was a decision.",
        body: `${origin} turned knowledge into method. At ${institution}, technique acquired discipline, memory and a future.`
      },
      {
        eyebrow: "Chapter 02 · The crossing",
        title: "Knowledge crossed the ocean.",
        body: `${traveler} carried this heritage to Brazil. In ${bridge} and ${brazilRoot}, it found new hands — and a new history.`
      },
      {
        eyebrow: "Chapter 03 · The guardians",
        title: "No generation arrived here by chance.",
        body: `The link stayed alive through ${guardians}: knowledge learned, proven and passed on. Every black belt became responsible for the next.`
      },
      {
        eyebrow: "Chapter 04 · Your name",
        title: `Today, the story reaches ${honoree}.`,
        body: `You are not merely a name on the tree. You are its ${englishOrdinal(generation)} generation Brazilian jiu-jitsu black belt — and a new starting point for everyone who follows.`
      }
    ],
    lineageCelebrationClosing: (name: string) =>
      `This lineage has reached ${name}. Now its next black belts can continue the tree.`,
    lineageContinues: "The tree continues",
    lineageJoinQuestion: (name: string) => `Did ${name} award your black belt?`,
    lineageJoinBody:
      "Your name can be the next link. Submit your certificates and request your place in this history.",
    lineageJoinAction: "Add my name to the tree",
    lineageLegacy: "Preserved legacy",
    youAreHere: "Your place in history",
    lineageSwipeHint: "Swipe to see the complete lineage →",
    copyDirectLineageLink: "Copy my direct link",
    directLinkCopied: "Direct link copied!",
    exitLineageCelebration: "Back to the tree",
    linkCopied: "Link copied!",
    unifiedTree: "Unified tree",
    resultLineage: "lineage",
    noResults: "No results",
    chooseLineage: "Choose lineage",
    searchPlaceholder: "Search across all lineages...",
    searchAria: "Search for a person across all lineages",
    close: "Close",
    overview: "Overview",
    legend: "Legend",
    bioExtracted: "Extracted from bio",
    partialName: "Partial name",
    desktopHint:
      "Drag to navigate · click a node to open its branch · use the wheel to zoom · press / to search",
    mobileHint: "Tap a node to open · drag to navigate · use two fingers to zoom",
    treeNavigation: "Tree navigation",
    backToTeacher: "Back to teacher (↑)",
    back: "Back",
    goToRoot: "Go to root (Home)",
    fitSelection: "Fit selection (F)",
    fit: "Fit",
    enter: "Join",
    details: "Details",
    zoomControls: "Zoom controls",
    help: "Help",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    lineagePath: "Lineage path",
    share: "Share",
    loading: "Loading lineages…",
    loadFailed: "The lineages could not be loaded.",
    retry: "Try again"
  }
} satisfies Record<Locale, object>;

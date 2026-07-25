import type { Locale } from "./locale";

export const joinCopy = {
  pt: {
    countryDefault: "Brasil",
    belt: {
      gray: ["Grupo de faixas cinza", "Cinza"],
      yellow: ["Grupo de faixas amarelas", "Amarela"],
      orange: ["Grupo de faixas laranja", "Laranja"],
      green: ["Grupo de faixas verdes", "Verde"],
      blue: ["Faixa azul", "Azul"],
      purple: ["Faixa roxa", "Roxa"],
      brown: ["Faixa marrom", "Marrom"],
      black: ["Faixa preta", "Preta"]
    },
    errors: {
      removeLater: (belts: string) =>
        `Remova primeiro os certificados posteriores: ${belts}.`,
      fileType: "Use certificados em PDF, JPG, PNG ou WebP.",
      fileSize: "Cada certificado deve ter no máximo 10 MB.",
      missing: (belts: string) => `Faltam os certificados obrigatórios: ${belts}.`,
      completeness: "Confirme que você anexou todos os certificados que recebeu.",
      submit: "Não foi possível enviar."
    },
    success: {
      eyebrow: "Recebemos sua conexão",
      title: "Agora começa a revisão.",
      beforeTeacher: "Sua solicitação de vínculo com",
      afterTeacher:
        "entrou na fila editorial. Ela ainda não está pública.",
      certificates: (count: number) =>
        `✓ ${count} certificado(s) recebido(s) como pré-evidência privada.`,
      protocol: "Guarde seu protocolo",
      track: "Acompanhar solicitação",
      back: "Voltar para a árvore"
    },
    heading: {
      eyebrow: "Formulário de linhagem",
      title: "Eu sou faixa-preta e quero fazer parte da árvore",
      note:
        "Campos marcados com * são necessários. Nenhum pedido é publicado automaticamente."
    },
    connection: {
      legend: "A conexão",
      fullName: "Seu nome completo *",
      fullNamePlaceholder: "Como seu nome deve aparecer",
      teacher: "Quem concedeu sua faixa-preta? *",
      teacherPlaceholder: "Ex.: Demian Maia",
      teacherFound: "✓ Pessoa localizada na árvore",
      inTree: "Na árvore",
      type: "Tipo de conexão *",
      claims: {
        black_belt_awarded_by: "Recebi a faixa-preta desta pessoa",
        co_awarded_black_belt: "Faixa-preta concedida por mais de um professor",
        trained_under: "Treinei sob esta pessoa"
      },
      promotionDate: "Data da graduação",
      academy: "Academia ou equipe",
      academyPlaceholder: "Ex.: Demian Maia Jiu-Jitsu",
      city: "Cidade",
      country: "País"
    },
    evidence: {
      legend: "Contato e evidências",
      email: "Seu e-mail *",
      emailPlaceholder: "Usado apenas para acompanhar a revisão",
      instagram: "Instagram",
      instagramPlaceholder: "@usuario ou link do perfil"
    },
    certificates: {
      eyebrow: "Trilha documental",
      title: "Da faixa branca até a preta",
      lede:
        "Envie a progressão completa. Os documentos são pré-evidências privadas e continuam dependendo de aprovação editorial.",
      youthCounter: "etapas da trajetória jovem",
      adultCounter: "certificados obrigatórios",
      youthCounterDetail: "4 obrigatórios + 4 juvenis quando recebidos",
      trackLabel: "Quando você começou no jiu-jitsu?",
      adult: "Comecei adulto",
      adultPath: "Branca → azul → roxa → marrom → preta",
      youth: "Comecei jovem",
      youthPath: "Inclui cinza, amarela, laranja e verde",
      whiteStartLabel: "Faixa branca:",
      whiteStart: "ponto de partida, sem certificado.",
      sequenceLabel: "Envio sequencial:",
      sequence: "azul libera roxa, roxa libera marrom e marrom libera preta.",
      lockedAria: (belt: string) => `${belt} bloqueada; conclua a faixa anterior`,
      lockedTitle: (belt: string) =>
        `Envie primeiro o certificado da faixa ${belt}.`,
      locked: "bloqueada",
      uploadNow: "envie agora",
      required: "obrigatório",
      optional: "opcional",
      certificateProgress: (current: number, total: number) =>
        `Certificado ${current} de ${total}`,
      supplemental: "Documento complementar",
      youthHelp: (belt: string) =>
        `Anexe um PDF consolidado ou uma imagem dos certificados do grupo ${belt} que você recebeu. Se não passou por este grupo, avance sem anexar.`,
      requiredHelp:
        "Este certificado é obrigatório para comprovar a continuidade da graduação até a faixa-preta.",
      optionalHelp: "Para uma solicitação de treino, este documento é opcional.",
      attach: (belt: string) => `Anexar certificado da faixa ${belt}`,
      privateFile: "arquivo privado",
      fileHelp: "PDF, JPG, PNG ou WebP · máximo 10 MB",
      date: "Data desta graduação",
      remove: "Remover arquivo",
      continue: (belt: string) => `Continuar para ${belt} →`,
      ready: "✓ Trilha pronta para revisão",
      blackRequired: "Anexe a faixa preta para concluir",
      declaration:
        "Confirmo que anexei todos os certificados de faixa que recebi durante minha graduação, inclusive os do percurso juvenil quando existirem.",
      note:
        "Azul, roxa, marrom e preta são obrigatórias para pedidos de faixa-preta. A faixa branca não possui certificado; os grupos juvenis são enviados quando existirem."
    },
    links: {
      label: "Links de evidência",
      placeholder:
        "Um link por linha: anúncio da graduação, post da academia, certificado digitalizado…",
      count: (count: number) => `${count}/8 links adicionados`,
      context: "Contexto da graduação",
      contextPlaceholder:
        "Ano, local, evento, outros professores presentes e qualquer contexto que ajude a conferência.",
      contextHelp:
        "Se não houver certificado ou link, descreva a graduação com algum detalhe."
    },
    consent:
      "Autorizo o uso destes dados para análise editorial e entendo que a inclusão depende de revisão. Meu e-mail não será exibido publicamente.",
    sending: "Enviando…",
    submit: "Enviar para revisão"
  },
  en: {
    countryDefault: "Brazil",
    belt: {
      gray: ["Gray belt group", "Gray"],
      yellow: ["Yellow belt group", "Yellow"],
      orange: ["Orange belt group", "Orange"],
      green: ["Green belt group", "Green"],
      blue: ["Blue belt", "Blue"],
      purple: ["Purple belt", "Purple"],
      brown: ["Brown belt", "Brown"],
      black: ["Black belt", "Black"]
    },
    errors: {
      removeLater: (belts: string) =>
        `Remove the later certificates first: ${belts}.`,
      fileType: "Use a valid PDF, JPG, PNG or WebP certificate.",
      fileSize: "Each certificate must be no larger than 10 MB.",
      missing: (belts: string) => `Required certificates are missing: ${belts}.`,
      completeness: "Confirm that you attached every certificate you received.",
      submit: "We could not submit your request."
    },
    success: {
      eyebrow: "We received your connection",
      title: "Editorial review starts now.",
      beforeTeacher: "Your relationship request involving",
      afterTeacher:
        "has entered the editorial queue. It is not public yet.",
      certificates: (count: number) =>
        `✓ ${count} certificate(s) received as private preliminary evidence.`,
      protocol: "Keep your tracking code",
      track: "Track request",
      back: "Back to the tree"
    },
    heading: {
      eyebrow: "Lineage form",
      title: "I am a black belt and want to become part of the tree",
      note:
        "Fields marked with * are required. No request is published automatically."
    },
    connection: {
      legend: "The connection",
      fullName: "Your full name *",
      fullNamePlaceholder: "How your name should appear",
      teacher: "Who awarded your black belt? *",
      teacherPlaceholder: "E.g. Demian Maia",
      teacherFound: "✓ Person found in the tree",
      inTree: "In the tree",
      type: "Connection type *",
      claims: {
        black_belt_awarded_by: "I received my black belt from this person",
        co_awarded_black_belt: "My black belt was jointly awarded by multiple instructors",
        trained_under: "I trained under this person"
      },
      promotionDate: "Promotion date",
      academy: "Academy or team",
      academyPlaceholder: "E.g. Demian Maia Jiu-Jitsu",
      city: "City",
      country: "Country"
    },
    evidence: {
      legend: "Contact and evidence",
      email: "Your email *",
      emailPlaceholder: "Used only to track the review",
      instagram: "Instagram",
      instagramPlaceholder: "@username or profile link"
    },
    certificates: {
      eyebrow: "Document trail",
      title: "From white belt to black belt",
      lede:
        "Submit the complete progression. Documents are private preliminary evidence and still require editorial approval.",
      youthCounter: "steps in the youth journey",
      adultCounter: "required certificates",
      youthCounterDetail: "4 required + 4 youth groups when received",
      trackLabel: "When did you start jiu-jitsu?",
      adult: "I started as an adult",
      adultPath: "White → blue → purple → brown → black",
      youth: "I started young",
      youthPath: "Includes gray, yellow, orange and green",
      whiteStartLabel: "White belt:",
      whiteStart: "the starting point, with no certificate.",
      sequenceLabel: "Sequential upload:",
      sequence: "blue unlocks purple, purple unlocks brown, and brown unlocks black.",
      lockedAria: (belt: string) => `${belt} locked; complete the previous belt`,
      lockedTitle: (belt: string) => `Upload the ${belt} certificate first.`,
      locked: "locked",
      uploadNow: "upload now",
      required: "required",
      optional: "optional",
      certificateProgress: (current: number, total: number) =>
        `Certificate ${current} of ${total}`,
      supplemental: "Supplementary document",
      youthHelp: (belt: string) =>
        `Attach one consolidated PDF or an image of the ${belt} group certificates you received. If you did not pass through this group, continue without an attachment.`,
      requiredHelp:
        "This certificate is required to prove continuous promotion through black belt.",
      optionalHelp: "This document is optional for a training relationship request.",
      attach: (belt: string) => `Attach ${belt} certificate`,
      privateFile: "private file",
      fileHelp: "PDF, JPG, PNG or WebP · maximum 10 MB",
      date: "Promotion date for this belt",
      remove: "Remove file",
      continue: (belt: string) => `Continue to ${belt} →`,
      ready: "✓ Journey ready for review",
      blackRequired: "Attach the black-belt certificate to finish",
      declaration:
        "I confirm that I attached every belt certificate I received during my progression, including youth certificates when applicable.",
      note:
        "Blue, purple, brown and black are required for black-belt requests. White belt has no certificate; youth groups are submitted when applicable."
    },
    links: {
      label: "Evidence links",
      placeholder:
        "One link per line: promotion announcement, academy post, scanned certificate…",
      count: (count: number) => `${count}/8 links added`,
      context: "Promotion context",
      contextPlaceholder:
        "Year, place, event, other instructors present, and any context that helps verification.",
      contextHelp:
        "If you have no certificate or link, describe the promotion in some detail."
    },
    consent:
      "I authorize the use of this information for editorial review and understand that inclusion requires approval. My email will not be displayed publicly.",
    sending: "Submitting…",
    submit: "Submit for review"
  }
} satisfies Record<Locale, unknown>;

export type PublicLineagePortrait = {
  src: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  objectPosition?: string;
};

/**
 * Curadoria de retratos com licença pública verificável.
 *
 * O identificador técnico continua sendo a chave porque ele é estável mesmo
 * quando o nome editorial muda. As imagens ficam locais para que a cerimônia
 * não dependa de hotlink, mas cada retrato mantém seu crédito e sua fonte.
 */
export const PUBLIC_LINEAGE_PORTRAITS: Readonly<Record<string, PublicLineagePortrait>> = {
  "canonical:kano": {
    src: "/lineage-portraits/jigoro-kano.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kano_Jigoro,_director_of_the_Tokyo_Higher_Normal_School.jpg",
    attribution: "Autor desconhecido / Tokyo Bunrika Daigaku, 1931",
    license: "Domínio público",
    objectPosition: "50% 28%"
  },
  "name:kodokan": {
    src: "/lineage-portraits/kodokan-1937.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kodokan_in_1937.jpg",
    attribution: "Kodokan, 1937 / Wikimedia Commons",
    license: "Domínio público",
    objectPosition: "58% 46%"
  },
  "canonical:maeda": {
    src: "/lineage-portraits/mitsuyo-maeda.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Mitsuyo_Maeda_c1910.jpg",
    attribution: "Autor desconhecido, c. 1910",
    license: "Domínio público",
    objectPosition: "50% 16%"
  },
  "canonical:carlos": {
    src: "/lineage-portraits/carlos-gracie.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Carlos_Gracie_(1951)_(cropped).tif",
    attribution: "Arquivo Nacional do Brasil / Correio da Manhã",
    license: "Domínio público",
    objectPosition: "62% 36%"
  },
  "name:demian-maia": {
    src: "/lineage-portraits/demian-maia.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Demian_Maia.jpg",
    attribution: "Peter Gordon / MartialArtsNomad",
    license: "CC BY 2.0",
    objectPosition: "50% 18%"
  }
};

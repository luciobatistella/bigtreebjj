import type { Locale } from "./i18n/locale";

type TimelineEvent = {
  year: string;
  title: string;
  seal: "DOC" | "ATE" | "TRA" | "ESP";
  body: string;
  source?: string;
  gap?: string;
  flag?: string;
  image?: {
    src: string;
    alt: string;
    credit: string;
    position?: string;
  };
  plate?: [string, string, string];
};

type TimelineBook = {
  book: string;
  title: string;
  span: string;
  events: TimelineEvent[];
};

const BOOKS: TimelineBook[] = [
  {
    book: "Livro I",
    title: "Raízes japonesas",
    span: "séc. XVI — 1904",
    events: [
      {
        year: "1532",
        title: "Takenouchi-ryū",
        seal: "ATE",
        body:
          "Fundação da escola geralmente apontada como a mais antiga tradição de jujutsu ainda em atividade.",
        gap: "Documento fundacional ainda não verificado por esta obra."
      },
      {
        year: "séc. XVII",
        title: "Nasce a palavra",
        seal: "DOC",
        flag: "Entrada zero da obra",
        body:
          "O termo jūjutsu vira um guarda-chuva para disciplinas de agarramento antes nomeadas separadamente: kumiuchi, taijutsu, yawara, torite, hakuda e koppō.",
        gap:
          "Nenhuma fonte aponta a primeira atestação datada do termo. Apurar densho de escolas Edo no acervo do Kodokan."
      },
      {
        year: "c. 1640",
        title: "Sekiguchi-ryū",
        seal: "DOC",
        body:
          "A escola reúne jūjutsu, kenjutsu e iaijutsu; em seu currículo o termo aparece nomeado."
      },
      {
        year: "1724",
        title: "O termo jūdō já existe",
        seal: "ATE",
        body:
          "Jūdō está em uso quase dois séculos antes de Kano — dado que desmonta a ideia de que a palavra nasceu com o Kodokan.",
        gap: "Localizar a fonte primária atribuída à Jikishin-ryū."
      },
      {
        year: "1868",
        title: "Restauração Meiji",
        seal: "DOC",
        body:
          "O fim da classe samurai e a proibição das espadas colapsam a economia das escolas tradicionais e abrem espaço para uma reinvenção pedagógica."
      },
      {
        year: "1882",
        title: "Kodokan",
        seal: "DOC",
        flag: "Virada institucional",
        body:
          "Jigoro Kano reorganiza o corpo técnico das koryū como projeto educacional, com método, hierarquia e vocação de exportação.",
        image: {
          src: "/lineage-portraits/jigoro-kano.jpg",
          alt: "Retrato histórico de Jigoro Kano",
          credit: "Autor desconhecido / Tokyo Bunrika Daigaku, 1931 · domínio público",
          position: "50% 28%"
        }
      },
      {
        year: "1897",
        title: "Maeda entra no Kodokan",
        seal: "ATE",
        body: "Mitsuyo Maeda torna-se aprendiz de judô.",
        gap: "Registro de matrícula ainda não verificado no acervo do Kodokan."
      },
      {
        year: "1904",
        title: "A diáspora",
        seal: "ATE",
        body:
          "Maeda parte em missão de difusão, passa por Estados Unidos, Europa, México, Cuba e América Central e aceita desafios como demonstração.",
        image: {
          src: "/lineage-portraits/mitsuyo-maeda.jpg",
          alt: "Retrato histórico de Mitsuyo Maeda",
          credit: "Autor desconhecido, c. 1910 · domínio público",
          position: "50% 16%"
        },
        gap: "Itinerário a reconstruir com imigração e imprensa local de cada país."
      }
    ]
  },
  {
    book: "Livro II",
    title: "O desembarque no Brasil",
    span: "1870 — 1929",
    events: [
      {
        year: "1870–75",
        title: "A palavra chega ao Ocidente",
        seal: "DOC",
        body:
          "Primeira entrada registrada de “jujitsu” na língua inglesa. A palavra viaja antes da prática."
      },
      {
        year: "1908",
        title: "Miyako e Kakihara desembarcam",
        seal: "DOC",
        flag: "Reescreve o marco de entrada",
        body:
          "Em 17 de dezembro, a imprensa registra a chegada ao Rio dos professores Sada Miyako e M. Kakihara, contratados como instrutores dos marinheiros brasileiros. Seis anos antes de Maeda.",
        source: "Gazeta de Notícias · 17 dez. 1908, p. 4",
        plate: ["Chapa 01", "Gazeta de Notícias", "Hemeroteca Digital · BN"]
      },
      {
        year: "1909",
        title: "Brasileiros ensinando brasileiros",
        seal: "DOC",
        flag: "Primeira transmissão nacional",
        body:
          "Marinheiros brasileiros já formados seguem para instruir aprendizes na Bahia. A transmissão conhecida é militar e pública, não familiar e privada.",
        source: "Gazeta de Notícias · 27 jun. 1909, p. 8"
      },
      {
        year: "c. 1909",
        title: "Miyako nos teatros",
        seal: "DOC",
        body:
          "Lutas entre modalidades distintas na capital federal contrariam a atribuição posterior do formato intermodalidades a uma única família.",
        gap: "Data, local e cobertura do combate com Cyríaco. Conflito C-06."
      },
      {
        year: "1913",
        title: "Mário Aleixo abre clube",
        seal: "ATE",
        body:
          "Surge o que fontes descrevem como o primeiro clube de jiu-jitsu do Brasil — antes de Maeda chegar.",
        gap: "Anúncio ou registro de funcionamento ainda não localizado."
      },
      {
        year: "1914",
        title: "Maeda desembarca no Pará",
        seal: "ATE",
        body:
          "Vinculado ao projeto de colônia japonesa, fixa-se em Belém, onde permanecerá até morrer, em 1941.",
        gap: "Outras fontes datam a fixação em 1915. Conflito C-03."
      },
      {
        year: "c. 1915",
        title: "Satake em Manaus",
        seal: "ATE",
        body:
          "Atua no Atlético Rio Negro Clube. Dele sai o vínculo mais firme de Luiz França e também Vinicius Ruas."
      },
      {
        year: "1920",
        title: "Os cinco do primeiro galão",
        seal: "DOC",
        flag: "Carlos Gracie não está na lista",
        body:
          "Maeda promove Jacyntho Ferro, Waldemar Lopes, Raphael Gomes, Guilherme DelaRocque e Matheus Pereira.",
        gap: "Referência exata do registro ainda precisa ser localizada."
      },
      {
        year: "1921",
        title: "O artigo que muda tudo",
        seal: "DOC",
        flag: "Peça central da revisão",
        body:
          "Um artigo identifica Donato Pires e Carlos Gracie como alunos de Jacyntho Ferro — não de Maeda. É a evidência contemporânea mais direta contra a linha reta consagrada.",
        gap: "Veículo, data e página ainda não identificados. Prioridade máxima.",
        plate: ["Chapa 03", "Artigo de 1921", "Hemeroteca Digital · BN"]
      },
      {
        year: "1925",
        title: "Omori em São Paulo",
        seal: "ATE",
        body:
          "Geo Omori estabelece-se em São Paulo, enfrenta os Gracie e declara publicamente que Carlos não fora instruído diretamente por Maeda."
      },
      {
        year: "1928",
        title: "Donato e a polícia de Minas",
        seal: "ATE",
        body:
          "Donato assina contrato para treinar a polícia mineira e convida Carlos Gracie como instrutor assistente."
      },
      {
        year: "1929",
        title: "Morre Jacyntho Ferro",
        seal: "ATE",
        body:
          "O elo desaparece antes de qualquer disputa pública sobre linhagem. Sem alguns artigos de jornal, teria desaparecido da história."
      }
    ]
  },
  {
    book: "Livro III",
    title: "A geração brasileira",
    span: "1930 — 1942",
    events: [
      {
        year: "1930",
        title: "A primeira academia",
        seal: "DOC",
        flag: "O nome na porta não era Gracie",
        body:
          "Em 9 de setembro inaugura a Academia de Jiu-Jitsu, na Rua Marques de Abrantes 106. Direção de Donato Pires; Carlos e George Gracie como professores.",
        source: "Correio da Manhã · 9 set. 1930",
        image: {
          src: "/lineage-portraits/carlos-gracie.jpg",
          alt: "Retrato histórico de Carlos Gracie",
          credit: "Arquivo Nacional do Brasil / Correio da Manhã · domínio público",
          position: "62% 36%"
        },
        plate: ["Chapa 04", "Correio da Manhã", "Hemeroteca Digital · BN"]
      },
      {
        year: "1931",
        title: "Aleixo perde para George",
        seal: "ATE",
        body:
          "O pioneiro de 1913 é finalizado por chave de braço no segundo round. Simbolicamente, a geração anterior sai de cena."
      },
      {
        year: "1932",
        title: "França entra na Marinha",
        seal: "ATE",
        body:
          "Aos 22 anos, Luiz França ingressa como Fuzileiro Naval. Sua atuação como precursor do sistema de defesa pessoal sobrevive como relato oral.",
        gap: "Assentamentos a solicitar. Local de nascimento em disputa: conflitos C-01 e C-02."
      },
      {
        year: "1939",
        title: "Donato em São Paulo",
        seal: "ATE",
        body:
          "Abre nova academia, dessa vez com George Gracie como assistente. Depois disso, some da narrativa oficial."
      },
      {
        year: "1942",
        title: "França gradua Fadda",
        seal: "ATE",
        flag: "Transmissão sem segredos",
        body:
          "Oswaldo Fadda recebe o grau de instrutor das mãos de Luiz França e levará a linhagem ao subúrbio carioca."
      }
    ]
  },
  {
    book: "Livro IV",
    title: "A era dos desafios",
    span: "1950 — 1951",
    events: [
      {
        year: "1950",
        title: "Fadda abre no subúrbio",
        seal: "ATE",
        body:
          "Abre academia em Bento Ribeiro, ensina em praças e praias e usa o jiu-jitsu no atendimento a pessoas com deficiência."
      },
      {
        year: "1951",
        title: "O subúrbio vence a Zona Sul",
        seal: "ATE",
        flag: "O desafio",
        body:
          "A equipe de Fadda desafia a Academia Gracie e vence com forte uso de chaves de pé, parte do currículo então desprezada."
      }
    ]
  },
  {
    book: "Livro V",
    title: "A esportivização",
    span: "1967 — 1973",
    events: [
      {
        year: "1967",
        title: "Federação da Guanabara",
        seal: "DOC",
        flag: "O forasteiro vira fundador",
        body:
          "Cinco escolas criam a Federação de Jiu-Jitsu da Guanabara. Oswaldo Fadda ocupa o posto de primeiro vice-técnico ao lado dos Gracie.",
        gap: "Ata de fundação ainda precisa ser localizada.",
        plate: ["Chapa 06", "Ata de fundação", "25 abr. 1967 · acervo a localizar"]
      },
      {
        year: "1967",
        title: "Nascem as regras",
        seal: "ATE",
        body:
          "A federação formaliza faixas, divisões etárias, tempo de combate e pontuação."
      },
      {
        year: "1973",
        title: "Esporte por lei",
        seal: "ATE",
        body:
          "Chegam o reconhecimento legal como esporte e o primeiro torneio oficial de jiu-jitsu do Brasil."
      }
    ]
  },
  {
    book: "Livro VI",
    title: "A diáspora global",
    span: "1980 — hoje",
    events: [
      {
        year: "1980s",
        title: "O nome muda",
        seal: "ATE",
        body:
          "A expansão internacional consolida o rótulo jiu-jitsu brasileiro. O termo é consequência da exportação, não da origem."
      },
      {
        year: "1993",
        title: "UFC 1",
        seal: "DOC",
        flag: "O palco vira o mundo",
        body:
          "Em Denver, Royce Gracie vence o primeiro UFC e converte uma disputa doméstica de linhagem em mercado global."
      },
      {
        year: "1994",
        title: "IBJJF e CBJJ",
        seal: "ATE",
        body:
          "Carlos Gracie Jr. estrutura federações, calendário, ranking e uma economia esportiva internacional."
      },
      {
        year: "1996",
        title: "Primeiro Mundial",
        seal: "ATE",
        body:
          "Começa a série anual do Campeonato Mundial, hoje disputada por atletas de dezenas de países."
      },
      {
        year: "2005",
        title: "Morre Oswaldo Fadda",
        seal: "ATE",
        body:
          "A linhagem recebida de Luiz França segue viva na Nova União, na GFTeam, nos campeonatos e no MMA.",
        gap: "A cadeia completa de graduações ainda precisa ser montada nó a nó."
      }
    ]
  }
];

const SEAL_LABELS = {
  DOC: "Documentado",
  ATE: "Atestado",
  TRA: "Tradicional",
  ESP: "Especulativo"
};

function Stripes({ count }: { count: number }) {
  return (
    <span className="ed-chronology-mark" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

export function EditorialTimeline({ locale }: { locale: Locale }) {
  const allEvents = BOOKS.flatMap((book) => book.events);
  const isEnglish = locale === "en";

  return (
    <section className="ed-master-chronology" id="cronologia">
      <header className="ed-chronology-hero">
        <p className="ed-doc-mono">{isEnglish ? "Appendix A · master timeline" : "Anexo A · cronologia mestra"}</p>
        <h2>
          Séc. XVI
          <em>→ hoje</em>
        </h2>
        <div>
          <span>
            <b>{allEvents.length}</b> entradas seladas
          </span>
          <span>
            <b>{BOOKS.length}</b> livros
          </span>
          <span>
            <b>{allEvents.filter((event) => event.seal === "DOC").length}</b> documentadas
          </span>
          <span>
            <b>{allEvents.filter((event) => event.gap).length}</b> lacunas abertas
          </span>
          <span>
            <b>{allEvents.filter((event) => event.plate).length}</b> chapas
          </span>
        </div>
      </header>

      {BOOKS.map((book) => (
        <div className="ed-chronology-book" key={book.book}>
          <header className="ed-chronology-era">
            <h3>{book.title}</h3>
            <p>
              {book.book} · {book.span}
            </p>
          </header>
          <div className="ed-chronology-track">
            <div className="ed-chronology-spine" aria-hidden="true" />
            <div className="ed-chronology-fill" aria-hidden="true" />
            {book.events.map((event, index) => (
              <article className={`ed-chronology-event${event.flag ? " is-turn" : ""}`} key={`${event.year}-${index}`}>
                <Stripes count={{ DOC: 4, ATE: 3, TRA: 2, ESP: 1 }[event.seal]} />
                {event.flag ? <span className="ed-chronology-flag">{event.flag}</span> : null}
                <time>{event.year}</time>
                <h4>{event.title}</h4>
                <p>{event.body}</p>
                <div className="ed-chronology-meta">
                  <span>{SEAL_LABELS[event.seal]}</span>
                  {event.source ? <strong>{event.source}</strong> : null}
                </div>
                {event.gap ? (
                  <aside className="ed-chronology-gap">
                    <em>Lacuna aberta</em>
                    {event.gap}
                  </aside>
                ) : null}
                {event.image ? (
                  <figure className="ed-chronology-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={event.image.alt}
                      src={event.image.src}
                      style={{ objectPosition: event.image.position }}
                    />
                    <figcaption>{event.image.credit}</figcaption>
                  </figure>
                ) : null}
                {event.plate ? (
                  <figure className="ed-chronology-plate">
                    <span>{event.plate[0]}</span>
                    <strong>{event.plate[1]}</strong>
                    <small>{event.plate[2]}</small>
                  </figure>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ))}

      <footer className="ed-chronology-research">
        <p className="ed-doc-mono">Fila de apuração</p>
        <h3>O que falta ir buscar</h3>
        <p>
          Prioridade um: o artigo de 1921 sobre Ferro, Donato e Carlos. Depois, o registro da
          promoção de 1920 e a série da Gazeta de Notícias sobre Miyako e Kakihara.
        </p>
      </footer>
    </section>
  );
}

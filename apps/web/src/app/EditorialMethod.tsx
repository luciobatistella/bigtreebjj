"use client";

import { useState } from "react";
import type { Locale } from "./i18n/locale";

type GradeCode = "DOC" | "ATE" | "TRA" | "ESP";

const GRADES = [
  {
    n: 4,
    code: "DOC" as GradeCode,
    name: "Documentado",
    description:
      "Fonte primária localizável e citável: jornal de época com veículo, data e página; registro civil; contrato; ata ou correspondência. Sem localização de acervo, o selo cai automaticamente.",
    example:
      "Inauguração da Academia de Jiu-Jitsu, Rua Marques de Abrantes 106, sob direção de Donato Pires dos Reis. Correio da Manhã, 9 de setembro de 1930."
  },
  {
    n: 3,
    code: "ATE" as GradeCode,
    name: "Atestado",
    description:
      "Testemunho de quem viveu o fato: entrevista, memória publicada ou declaração de contemporâneo. Tem peso real, mas nenhum documento o confirma — e o interesse do depoente permanece visível.",
    example:
      "Geo Omori afirma publicamente que Carlos Gracie não foi instruído diretamente por Maeda. Testemunho de adversário: peso real, viés registrado."
  },
  {
    n: 2,
    code: "TRA" as GradeCode,
    name: "Tradicional",
    description:
      "Narrativa consagrada por família, linhagem ou academia, sem base primária identificada. Não significa falso: significa ainda não verificado.",
    example:
      "Carlos Gracie foi aluno direto de Mitsuyo Maeda. Repetido por toda a literatura de linhagem; contradito pela imprensa de 1921."
  },
  {
    n: 1,
    code: "ESP" as GradeCode,
    name: "Especulativo",
    description:
      "Inferência moderna construída a partir de dados indiretos. Entra sempre com o nome de quem especula, para que o leitor pese o argumento e não a autoridade.",
    example:
      "Robert Drysdale sugere que Luiz França teria aprendido com os próprios Gracie ou sido em boa parte autodidata."
  }
];

const CLAIMS = [
  {
    title:
      "Donato Pires dos Reis dirigiu a primeira academia de jiu-jitsu do Brasil, inaugurada em 1930.",
    code: "DOC" as GradeCode,
    n: 4,
    why:
      "A cobertura da inauguração existe, é nominal e descreve a demonstração de abertura. Não depende da memória posterior de ninguém.",
    source: "Correio da Manhã · 9 set. 1930"
  },
  {
    title: "Luiz França foi aluno direto de Mitsuyo Maeda.",
    code: "TRA" as GradeCode,
    n: 2,
    why:
      "A afirmação é repetida com a ressalva de “supostamente”. Não há graduação, matrícula nem registro de imprensa ligando os dois. O vínculo com Satake é atestado.",
    source: "Sem documento · conflito aberto"
  },
  {
    title: "Sada Miyako desembarcou no Rio em 1908 como instrutor da Marinha brasileira.",
    code: "DOC" as GradeCode,
    n: 4,
    why:
      "O registro de chegada é nominal, informa o navio e a função. Ele antecede Maeda em seis anos e desloca o marco de entrada do jiu-jitsu no Brasil.",
    source: "Gazeta de Notícias · 17 dez. 1908, p. 4"
  },
  {
    title: "O termo jūjutsu foi cunhado no século XVII.",
    code: "ATE" as GradeCode,
    n: 3,
    why:
      "É consenso da literatura, mas nenhuma fonte aponta a primeira atestação datada. “Século XVII” é um teto de consenso, não um registro.",
    source: "Lacuna crítica · conflito C-07"
  }
];

const ASSERTION_FIELDS = [
  ["Enunciado", "Frase única, no indicativo, sem hedge. Se não cabe numa frase, são duas asserções."],
  ["Selo", "Documentado, Atestado, Tradicional ou Especulativo."],
  ["Fonte", "Referência completa. Imprensa: veículo, data e página, sem exceção."],
  ["Acervo", "Onde o documento está fisicamente ou digitalmente. Sem isso, o selo cai."],
  ["Concorrentes", "Identificadores das asserções que contradizem esta."],
  ["Status", "Aberta, resolvida ou arquivada."],
  ["Nota", "O que exatamente falta para resolver."]
];

const ENTRY_FIELDS = [
  ["Nome", "Grafia adotada e todas as variantes atestadas."],
  ["Datas", "Nascimento e morte, com selo por data — elas podem divergir entre si."],
  ["Nascimento", "Local, com selo próprio."],
  ["Formação", "Quem ensinou, quando e onde, com selo por vínculo."],
  ["Graduação", "O que recebeu, de quem e quando."],
  ["Atuação", "Onde ensinou, para quem, em que período."],
  ["Descendência", "Alunos com vínculo verificável."],
  ["Registro", "Inventário do que existe: jornais, fotos e documentos oficiais."],
  ["Conflitos", "Identificadores das disputas em aberto."],
  ["Apuração", "O que buscar, e onde, para fechar as lacunas."]
];

const PLATES = [
  ["Chapa 01", "Gazeta de Notícias", "17 dez. 1908, p. 4", "Hemeroteca Digital · BN"],
  ["Chapa 02", "Gazeta de Notícias", "27 jun. 1909, p. 8", "Hemeroteca Digital · BN"],
  ["Chapa 03", "Artigo de 1921", "Veículo e página a identificar", "Prioridade máxima"],
  ["Chapa 04", "Correio da Manhã", "9 set. 1930", "Hemeroteca Digital · BN"],
  ["Chapa 05", "Assentamentos", "Luiz França · ingresso 1932", "Arquivo da Marinha"],
  ["Chapa 06", "Ata de fundação", "25 abr. 1967", "Federação da Guanabara"]
];

function Stripes({ count, large = false }: { count: number; large?: boolean }) {
  return (
    <span className={`ed-proof-tip${large ? " ed-proof-tip-large" : ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function FieldList({ fields }: { fields: string[][] }) {
  return (
    <ol className="ed-method-fields">
      {fields.map(([title, description]) => (
        <li key={title}>
          <b>{title}</b>
          <span>{description}</span>
        </li>
      ))}
    </ol>
  );
}

export function EditorialMethod({ locale }: { locale: Locale }) {
  const [activeClaim, setActiveClaim] = useState(0);
  const claim = CLAIMS[activeClaim];
  const isEnglish = locale === "en";

  return (
    <section className="ed-method-document" id="metodo">
      <header className="ed-method-document-hero">
        <div>
          <p className="ed-doc-mono">
            {isEnglish ? "Normative document 00 · version 0.2" : "Documento normativo 00 · versão 0.2"}
          </p>
          <h2>
            {isEnglish ? "Every claim" : "Toda afirmação"}
            <em>{isEnglish ? "wears a belt" : "usa faixa"}</em>
          </h2>
          <div className="ed-method-hero-belt" aria-hidden="true">
            <span />
            <Stripes count={4} large />
          </div>
          <div className="ed-method-hero-foot">
            <p>{isEnglish ? "4 grades of proof" : "4 graus de prova"}</p>
            <p>{isEnglish ? "No sentence enters without a grade" : "Nenhuma frase entra sem selo"}</p>
            <p>{isEnglish ? "The work classifies; you decide" : "A obra classifica; você arbitra"}</p>
          </div>
        </div>
      </header>

      <div className="ed-method-chapter ed-method-chapter-moss">
        <div className="ed-method-head">
          <p className="ed-doc-mono">01 · {isEnglish ? "Founding principle" : "Princípio fundador"}</p>
          <h3>
            {isEnglish ? "The work does not choose a side." : "A obra não escolhe o lado."}
            <br />
            {isEnglish ? "It shows the evidence." : "Ela mostra o lastro."}
          </h3>
          <p>
            {isEnglish
              ? "When two sources contradict each other, both enter the work with the kind of evidence supporting each one visible before the reader begins."
              : "Quando duas fontes se contradizem, as duas entram — cada uma com o tipo de prova que a sustenta, visível antes da leitura."}
          </p>
          <p>
            <strong>
              {isEnglish
                ? "A declared gap is preferable to a plausible sentence without a source."
                : "É preferível uma lacuna declarada a uma frase plausível sem fonte."}
            </strong>
          </p>
        </div>

        <div className="ed-grade-list">
          {GRADES.map((grade) => (
            <article className={`ed-grade-row ed-grade-${grade.code.toLowerCase()}`} key={grade.code}>
              <div>
                <Stripes count={grade.n} />
                <p>
                  {grade.n}
                  <small>{grade.n === 1 ? "grau" : "graus"}</small>
                </p>
              </div>
              <div>
                <h4>{grade.name}</h4>
                <p>{grade.description}</p>
                <aside>
                  <em>Exemplo na base</em>
                  {grade.example}
                </aside>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="ed-method-chapter">
        <div className="ed-method-head">
          <p className="ed-doc-mono">02 · {isEnglish ? "Evidence grader" : "Aferidor"}</p>
          <h3>{isEnglish ? "See the system working" : "Veja o sistema funcionando"}</h3>
          <p>
            {isEnglish
              ? "Choose a real claim and see the grade it receives — and why."
              : "Quatro afirmações reais circulam com o mesmo peso. Toque em cada uma e veja o grau que ela recebe — e por quê."}
          </p>
        </div>
        <div className="ed-method-bench">
          <div>
            {CLAIMS.map((item, index) => (
              <button
                aria-pressed={activeClaim === index}
                key={item.title}
                onClick={() => setActiveClaim(index)}
                type="button"
              >
                {item.title}
              </button>
            ))}
          </div>
          <div className="ed-method-bench-result" key={claim.title}>
            <Stripes count={claim.n} large />
            <h4>{GRADES.find((grade) => grade.code === claim.code)?.name}</h4>
            <p>{claim.why}</p>
            <strong>{claim.source}</strong>
          </div>
        </div>
      </div>

      <div className="ed-method-chapter ed-method-chapter-moss">
        <div className="ed-method-head">
          <p className="ed-doc-mono">03 · {isEnglish ? "The two locks" : "As duas travas"}</p>
          <h3>{isEnglish ? "What prevents inflation" : "O que impede a inflação"}</h3>
        </div>
        <div className="ed-method-locks">
          <article>
            <h4>Regra do rebaixamento</h4>
            <p>
              Na dúvida entre dois selos, vale sempre o mais fraco. Um Documentado sem localização
              de acervo é, na prática, um Atestado — porque ninguém consegue conferir.
            </p>
          </article>
          <article>
            <h4>Regra da não-promoção</h4>
            <p>
              Repetição não promove selo. Uma afirmação Tradicional reproduzida por cem academias
              continua Tradicional. Só documento novo muda grau.
            </p>
          </article>
        </div>
        <blockquote>Só documento novo muda grau</blockquote>
      </div>

      <div className="ed-method-chapter">
        <div className="ed-method-head">
          <p className="ed-doc-mono">04 · Anatomia</p>
          <h3>A ficha de asserção</h3>
          <p>
            Toda afirmação controversa vira registro próprio. Sete campos, sempre na mesma ordem,
            para que outra pessoa possa retomar a apuração de onde ela parou.
          </p>
        </div>
        <FieldList fields={ASSERTION_FIELDS} />
      </div>

      <div className="ed-method-chapter ed-method-chapter-moss">
        <div className="ed-method-head">
          <p className="ed-doc-mono">05 · Anatomia</p>
          <h3>O verbete</h3>
          <p>
            Dez campos, ordem fixa. Campo sem fonte aparece como lacuna — nunca é omitido. A
            omissão esconde o buraco; a lacuna aponta para ele.
          </p>
        </div>
        <FieldList fields={ENTRY_FIELDS} />
      </div>

      <div className="ed-method-chapter">
        <div className="ed-method-head">
          <p className="ed-doc-mono">06 · Iconografia</p>
          <h3>As chapas</h3>
          <p>
            A imagem da pesquisa é o documento: página de jornal, assentamento, contrato ou ata.
            Cada chapa abaixo tem um destino definido até a digitalização chegar do acervo.
          </p>
        </div>
        <div className="ed-method-plates">
          {PLATES.map(([id, title, detail, archive]) => (
            <figure key={id}>
              <span>{id}</span>
              <strong>{title}</strong>
              <p>{detail}</p>
              <small>{archive}</small>
            </figure>
          ))}
        </div>
      </div>

      <div className="ed-method-chapter ed-method-chapter-moss">
        <div className="ed-method-head">
          <p className="ed-doc-mono">07 · Conflito e lacuna</p>
          <h3>Onde a obra admite que não sabe</h3>
          <p>
            Versões concorrentes permanecem lado a lado com seus selos e com o teste documental
            que resolveria a disputa. Um conflito só fecha com documento novo.
          </p>
        </div>
        <blockquote>Lacuna é conteúdo, não falha</blockquote>
      </div>
    </section>
  );
}

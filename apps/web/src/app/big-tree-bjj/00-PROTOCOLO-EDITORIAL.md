# PROTOCOLO EDITORIAL
## Obra de referência sobre a história do jiu-jitsu — documento normativo

**Versão 0.1** — documento vivo. Toda alteração aqui obriga revisão retroativa dos capítulos já escritos.

---

## 1. Princípio fundador

Nenhuma afirmação entra na obra sem selo de evidência. A obra não arbitra entre versões concorrentes: ela **classifica** cada versão pelo tipo de sustentação que possui e apresenta as concorrentes lado a lado. O leitor arbitra.

Corolário prático: é preferível uma lacuna declarada a uma frase plausível sem fonte. Plausibilidade não é evidência.

---

## 2. Sistema de selos

Todo enunciado factual recebe um destes quatro selos, entre colchetes, ao fim da frase ou do parágrafo:

| Selo | Significado | Requisito |
|---|---|---|
| `[DOC]` | **Documentado** | Fonte primária localizável e citável: jornal de época, registro civil, ata, contrato, correspondência, documento oficial. Exige referência completa com localização de acervo. |
| `[ATE]` | **Atestado** | Testemunho de contemporâneo (entrevista, memória publicada, declaração de terceiro que conviveu), sem documento confirmatório. |
| `[TRA]` | **Tradicional** | Narrativa consagrada por família, linhagem ou instituição, sem base primária identificada. |
| `[ESP]` | **Especulativo** | Inferência de pesquisador moderno a partir de dados indiretos. Exige nomear o pesquisador. |

**Regra de rebaixamento:** na dúvida entre dois selos, use o mais fraco. Um `[DOC]` sem localização de acervo é, na prática, um `[ATE]`.

**Regra de não-promoção:** repetição não promove selo. Uma afirmação `[TRA]` reproduzida por cem academias continua `[TRA]`.

---

## 3. Ficha de asserção

Toda afirmação controversa ganha ficha própria no anexo de asserções. Formato:

```
ID:            A-000
ENUNCIADO:     (frase única, no indicativo, sem hedge)
SELO:          [DOC] / [ATE] / [TRA] / [ESP]
FONTE:         (referência completa)
ACERVO:        (onde o documento está fisicamente/digitalmente)
CONCORRENTES:  (IDs das asserções que contradizem esta)
STATUS:        aberta / resolvida / arquivada
NOTA:          (o que falta para resolver)
```

---

## 4. Verbete biográfico — estrutura fixa

Todo verbete segue esta ordem, sem exceção. Campos sem fonte aparecem como `LACUNA`, nunca omitidos.

1. **Nome** — grafia adotada + variantes atestadas
2. **Datas** — nascimento e morte, com selo por data (podem divergir entre si)
3. **Local de nascimento** — com selo
4. **Formação** — quem ensinou, quando, onde, com selo por vínculo
5. **Graduação** — o que recebeu, de quem, quando, com selo
6. **Atuação** — onde ensinou, para quem, em que período
7. **Descendência** — alunos com vínculo verificável
8. **Registro documental** — inventário do que existe: jornais, fotos, documentos oficiais
9. **Conflitos abertos** — IDs das asserções em disputa
10. **Fila de apuração** — o que buscar para fechar as lacunas

---

## 5. Regras de citação

- Fonte primária de imprensa cita-se sempre: **veículo, data, página**. Sem página, o selo cai para `[ATE]`.
- Fonte secundária nunca sustenta um `[DOC]`. Ela sustenta, no máximo, um `[ATE]`, e a obra registra que o documento original não foi visto.
- Quando uma fonte secundária cita uma primária que não conseguimos verificar, escreve-se: *"X afirma, citando o jornal Y de data Z, que… (documento não verificado por esta obra)"*.
- Nada de reprodução extensa de texto de terceiros. Paráfrase com atribuição; citação literal apenas quando a formulação exata for o objeto da análise, e curta.

---

## 6. Convenções de grafia e nome

- **Termo:** a obra usa `jiu-jitsu` no corpo do texto para a prática no Brasil; `jūjutsu` para a prática japonesa histórica; `judô` para o sistema Kodokan a partir de 1882. Grafias de época (`jiu-jítsu`, `jiu-jitsu`, `ju-jutsu`, `jiu jitsu`) preservam-se dentro de citações.
- **Nomes japoneses:** ordem ocidental (nome, sobrenome) no corpo do texto, com a ordem japonesa e o kanji na primeira ocorrência e no verbete.
- **Variantes de nome:** a obra adota uma grafia canônica por pessoa e lista todas as variantes atestadas no verbete. Ex.: Jacyntho / Jacinto Ferro; Guilherme DelaRocque / De La Roque; Mitsuyo / Mitsuyu / Esai Maeda.

---

## 6b. Categoria de conflito: disputa pós-vínculo

Até aqui, todo conflito registrado na obra era de **origem**: duas versões concorrentes sobre *quem ensinou quem*. É o formato padrão — Maeda ou Ferro, Satake ou autodidata, Manaus ou Alagoas.

O verbete de Waldemar Santana revelou um tipo diferente, que o formato de origem não descreve bem. Ali o vínculo em si é incontestado: ele foi aluno, isso nenhuma fonte disputa. **A disputa é sobre o que aconteceu depois de o vínculo já estabelecido se romper** — o número de combates, os resultados, a versão de cada lado sobre a ruptura.

A obra passa a reconhecer isto como categoria própria:

| Tipo | Objeto da disputa | Exemplo |
|---|---|---|
| **Conflito de origem** | Se o vínculo existiu, e com quem | Carlos Gracie: Maeda ou Ferro |
| **Conflito pós-vínculo** | O que aconteceu depois de um vínculo estabelecido e incontestado | Santana x Carlson: número e resultado dos combates após a ruptura com a família |

**Por que a distinção importa:** um conflito de origem normalmente se resolve com um documento de graduação, matrícula ou identificação de professor — uma peça só. Um conflito pós-vínculo raramente se resolve com uma peça única, porque o objeto é uma **série de eventos ao longo do tempo**, não um fato pontual. Fechá-lo exige reconstruir a série inteira, combate a combate, ano a ano — o teste documental é sempre plural.

**Marcação:** a ficha de asserção (§3) ganha um campo opcional `categoria_conflito`, com valores `origem` ou `pos_vinculo`. Quando ausente, assume-se `origem` por ser o caso mais comum na obra até aqui.

**Caso fundador:** C-16, o número e o resultado dos combates entre Carlson Gracie e Waldemar Santana após a ruptura deste com a família. É o primeiro conflito da obra a ser explicitamente classificado como pós-vínculo.

---

## 7. Tratamento de conflito

Quando duas fontes se contradizem, a obra **não escolhe**. Ela abre um registro de conflito no arquivo `90-CONFLITOS.md` com:

- as versões, cada uma com seu selo;
- o que cada uma implica se verdadeira;
- o teste que resolveria a disputa (qual documento, em qual acervo).

Um conflito só se fecha com documento novo, jamais por argumento de autoridade ou por peso da tradição.

---

## 8. Regra da lacuna

Onde não há fonte, escreve-se `LACUNA` seguido da pergunta específica em aberto. Exemplo:

> `LACUNA` — Não localizamos registro civil de Luiz França. Buscar em cartórios de Manaus (AM) e de municípios alagoanos, 1910–1912.

Lacunas são conteúdo, não falha. Elas são o mapa do que a próxima geração de pesquisadores precisa fazer.

---

## 9. Estrutura da obra

| Livro | Recorte | Estado |
|---|---|---|
| I | Raízes japonesas: koryū, o termo, a síntese Kano | esqueleto |
| II | Diáspora e desembarque no Brasil (1904–1920) | esqueleto |
| III | A geração brasileira (1913–1935) | esqueleto |
| IV | A era dos desafios (1930–1970) | não iniciado |
| V | Esportivização: federações, faixas, regras | não iniciado |
| VI | Diáspora global e o MMA (1970–hoje) | não iniciado |
| VII | Historiografia e o que está em aberto | não iniciado |
| Anexo A | Cronologia mestra | em construção |
| Anexo B | Verbetes biográficos | não iniciado |
| Anexo C | Índice de fontes primárias e acervos | não iniciado |
| Anexo D | Registro de asserções e conflitos | não iniciado |

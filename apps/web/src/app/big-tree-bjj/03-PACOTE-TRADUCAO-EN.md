# PACOTE DE TRADUÇÃO — INGLÊS
## The Big Tree BJJ

**Versão 0.1.** Este pacote parte do princípio estabelecido no plano editorial: **tradução em lote, não contínua**, com controle por hash em `ferramentas/traducao.py`. Ler isso primeiro, traduzir depois.

---

## 1. Estado atual, medido, não estimado

```
python3 ferramentas/traducao.py --idioma en
```

- **46 verbetes** no total (43 na árvore de linhagem + 3 do Livro VII, historiografia).
- **43 nunca traduzidos.**
- **3 traduzidos antes e hoje desatualizados**, porque o português mudou depois da tradução: `maeda`, `ferro`, `franca`.
- **~8.630 palavras** de prosa canônica pendentes, ao todo.

Isso não é uma amostra — é o inventário completo, porque os esqueletos de todos os 46 verbetes já foram semeados em `conteudo/en.json` (vazios, aguardando texto). O relatório acima é exato, não uma projeção.

---

## 2. Quem deveria traduzir isto

**Alguém que treina ou treinou jiu-jitsu, com inglês de nível nativo ou muito próximo.** Não é trabalho para tradutor genérico nem para tradução automática. Termos como "primeiro galão", "chave de pé" e os quatro selos de evidência (`Documentado`, `Atestado`, `Tradicional`, `Especulativo`) têm peso técnico e editorial específico — errar a tradução de um selo, por exemplo, quebra a lógica central da obra.

---

## 3. Glossário fixo — não traduzir por conta própria

| Termo em português | Termo fixado em inglês | Nota |
|---|---|---|
| Documentado | Documented | selo, já presente em `index.html` |
| Atestado | Attested | selo |
| Tradicional | Traditional | selo |
| Especulativo | Speculative | selo |
| primeiro galão | first stripe | graduação concedida por Maeda em 1920 |
| chave de pé | footlock | técnica central do arco Fadda → Danaher |
| chave de calcanhar / heel hook | heel hook | manter em inglês mesmo no texto em português, é o termo técnico corrente |
| vale-tudo | vale tudo (sem tradução) | termo consagrado internacionalmente sem tradução |
| faixa | belt | graduação |
| academia | academy | mas atenção ao contexto: às vezes "gym" é mais natural em inglês contemporâneo — usar "academy" para as instituições históricas (1930, federações) e considerar "gym"/"academy" conforme o contexto para as equipes modernas |
| jiu-jitsu brasileiro | Brazilian jiu-jitsu (BJJ na segunda menção em diante) | |
| Zona Sul / Zona Norte (Rio) | South Zone / North Zone | manter capitalizado, são regiões reconhecíveis |
| subúrbio (carioca) | suburb / suburban | cuidado: "suburb" em inglês americano tem conotação de classe média-alta — o sentido aqui é oposto (periferia popular). Considerar "working-class outskirts" quando a conotação de classe for o ponto central do parágrafo |

Nomes próprios, títulos de jornal e nomes de instituições **nunca se traduzem**: "Correio da Manhã", "Gazeta de Notícias", "Federação de Jiu-Jitsu da Guanabara" permanecem em português mesmo no texto em inglês, com uma tradução entre parênteses na primeira ocorrência se ajudar a compreensão.

---

## 4. Regras de forma

- **Nenhuma data, ano ou selo no corpo do texto traduzido.** Isso é regra da obra inteira, não só do português: fatos vivem em `nucleo.json`, prosa é só prosa. Se o português que você está traduzindo não tem data solta no meio da frase, o inglês também não deve ter.
- **Um campo, uma tradução fiel — não uma reescrita.** O objetivo não é "melhorar" o texto em inglês, é traduzi-lo. Mudanças de conteúdo (adicionar um fato, remover uma ressalva) devem ser feitas no português primeiro, nunca direto na tradução.
- **Preservar o tom.** A obra escreve em prosa corrida, não em bullet points nem em linguagem de marketing. Frases longas e conectadas são a norma, não o problema.

---

## 5. Ordem de tradução recomendada

Não traduza em ordem alfabética. Traduza por **prioridade de leitura** — o que um visitante estrangeiro vai abrir primeiro:

**Onda A — os oito pilares (P1), ~2.000 palavras**
`maeda` (atualizar, já traduzido antes) · `ferro` (atualizar) · `franca` (atualizar) · `miyako` · `aleixo` · `donato` · `carlos` · `fadda`

**Onda B — as origens completas (P2), ~2.200 palavras**
`kano` · `satake` · `omori` · `kakihara` · `yano` · `lopes` · `gomes` · `delarocque` · `pereira` · `ruas` · `bianor` · `kodokan`

**Onda C — a geração brasileira e os desafios (P3), ~2.400 palavras**
`gastaopai` · `helio` · `george` · `oswaldo` · `gastaojr` · `rocha` · `acad1930` · `kato` · `kimura` · `santana` · `carlson` · `barretoalvaro` · `barretojoao` · `binda` · `barradas` · `robson` · `federacao_guanabara`

**Onda D — era global e historiografia (P4/P7), ~2.000 palavras**
`rorion` · `royce` · `carlosjr` · `danaher` · `ufc` · `ibjjf` · `pedreira` · `drysdale` · `reila`

---

## 6. Fluxo operacional

1. Abra `conteudo/en.json`. Cada verbete já tem uma chave vazia (`{}`) esperando os campos.
2. Copie a estrutura do verbete correspondente em `conteudo/pt.json` como molde: `nome`, `epiteto`, `abertura`, `formacao`, `atuacao`, `descendencia`, `nota`, `lacuna`, `apuracao`.
3. Traduza campo a campo.
4. Ao terminar um verbete, rode:
   ```
   python3 ferramentas/traducao.py --selar en <chave>
   ```
   Isso grava o hash do português no momento da tradução — é o que permite ao sistema detectar, no futuro, se o português mudou e a tradução ficou para trás.
5. Rode `python3 ferramentas/integridade.py` para garantir que nada quebrou.
6. Rode `python3 ferramentas/compilar_arvore.py --injetar` — o `index.html` já tem fallback automático para português em qualquer verbete ainda não traduzido, então o site nunca quebra, mas cada verbete que você fecha aparece imediatamente em inglês nativo, sem selo de pendência.

---

## 7. Espanhol vem depois

Por decisão do plano editorial, espanhol só entra depois que o inglês estiver publicado e validado em mercado. Não iniciar tradução em espanhol antes disso — evita traduzir duas vezes o mesmo texto que ainda pode mudar.

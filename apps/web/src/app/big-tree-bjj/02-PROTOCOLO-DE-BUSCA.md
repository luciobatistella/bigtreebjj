# ONDA 2 — PROTOCOLO DE BUSCA EM ACERVO

**Versão 0.1.** Este documento existe porque a apuração em arquivo físico ou digital não pode ser feita por esta obra sozinha — precisa de alguém sentado na frente do acervo. O que segue é o roteiro pronto para usar.

---

## 0. Limitação confirmada, para você não perder tempo

A Hemeroteca Digital Brasileira (`memoria.bn.gov.br/hdb/`) é pública e gratuita, mas o sistema de busca é um formulário antigo em ASP.NET WebForms, com envio de formulário via evento de página (`__doPostBack`). Isso significa:

- **Não é possível montar uma URL de busca direta** (tipo `?q=termo&data=1921`) e obter resultado. O formulário precisa ser preenchido e enviado interativamente, no navegador.
- Ferramentas automatizadas de busca na web (inclusive as que esta obra usa) não conseguem consultar o acervo por dentro — só encontram o que já foi indexado por buscadores externos ou citado em outras páginas.
- **Conclusão prática:** a apuração das chapas abaixo exige um humano, no navegador, na URL `https://memoria.bn.gov.br/hdb/defaultnew.aspx`.

Isso não é um obstáculo pequeno, mas é bom saber com certeza em vez de supor.

---

## 1. Como buscar, passo a passo

1. Acesse `https://memoria.bn.gov.br/hdb/defaultnew.aspx`.
2. Use a busca por **título do periódico** quando o veículo já é conhecido (ver tabela abaixo) — reduz drasticamente o ruído.
3. Combine com **período** (data inicial e final) sempre que possível.
4. A busca textual usa OCR — nomes próprios de 1908–1930 frequentemente saem com erro de reconhecimento (ex.: "Jacyntho" pode aparecer como "Jacynflio", "Jacintho" etc.). **Teste variantes de grafia.**
5. Quando a busca por palavra falhar, **navegue por data diretamente**: a maioria dos veículos abaixo permite abrir a edição do dia exato sem depender do OCR.

---

## 2. Fila de apuração, em ordem de prioridade

| # | Chapa | O que buscar | Veículo | Data | Por quê importa |
|---|---|---|---|---|---|
| 1 | Chapa 03 | "Jacyntho Ferro" OU "Donato Pires" próximo a "Carlos Gracie" | não identificado — testar *O Globo*, *Correio da Manhã*, *Jornal do Brasil* | 1921 (ano inteiro) | Peça central de toda a revisão historiográfica. Sem ela, o Livro II inteiro descansa em citação de segunda mão. |
| 2 | Chapa 08 | "Jacyntho Ferro" OU "primeiro galão" próximo a "jiu-jitsu" | imprensa paraense | 1920 | Única graduação de brasileiros por Maeda que se pode confirmar — hoje sustentada só por convergência de fontes secundárias. |
| 3 | Chapa 04 | "jiu-jitsu" | *Correio da Manhã* | 9 set. 1930 | Inauguração da primeira academia do Brasil. Data e veículo já são conhecidos — é a busca de menor risco desta lista. |
| 4 | Chapa 01 e 02 | "Miyako" OU "Kakihara" | *Gazeta de Notícias* | 17 dez. 1908 e 27 jun. 1909 | Reescreve o marco de entrada do jiu-jitsu no Brasil, de 1914 para 1908. |
| 5 | Chapa 18 (verificação) | "Cyríaco" próximo a "jiu-jitsu" | *O Paiz* | 2 maio 1909, p. 2 | Já citada por artigo acadêmico (ver Livro VII) — esta é uma **verificação**, não uma busca do zero. Confirma ou corrige a transcrição de terceiros. |
| 6 | Chapa 11 | "Kimura" OU "Hélio Gracie" | jornais cariocas de grande circulação | 23–24 out. 1951 | O combate mais citado da bibliografia mundial ainda não tem citação primária própria nesta obra. |
| 7 | Chapa 16 | "Federação de Jiu-Jitsu da Guanabara" | *Diário Oficial* ou imprensa carioca | 25 abr. 1967 | Ata de fundação nunca localizada; sustenta todo o organograma do Livro V. |
| 8 | Chapa 05 | "Mário Aleixo" próximo a "George Gracie" | imprensa carioca | 3 dez. 1931 | Fecha o conflito C-08 sobre a formação de Aleixo. |
| 9 | Chapa 09 | registro fundacional | acervo do Kodokan, Tóquio — fora da Hemeroteca | 1882 | Único item desta lista que não está na Hemeroteca. Requer contato direto com a instituição japonesa. |

---

## 3. O que fazer ao encontrar algo

1. Anotar veículo, data **e página exata** — sem página, o achado não sobe para `DOC` (ver protocolo, regra do rebaixamento).
2. Salvar a imagem em alta resolução (100% de zoom, conforme o próprio tutorial da Hemeroteca).
3. Atualizar `conteudo/nucleo.json`: preencher `pagina`, marcar `digitalizado: true`, e subir o(s) selo(s) dos vínculos que dependiam daquela fonte.
4. Rodar `python3 ferramentas/integridade.py` para confirmar que a base continua íntegra após a mudança.
5. Rodar `python3 ferramentas/compilar_arvore.py --injetar` para a árvore refletir o novo selo.

---

## 4. Fora da Hemeroteca

- **Arquivo da Marinha do Brasil** — assentamento de Luiz França, ingresso de 1932. Requer solicitação formal, não é digital.
- **Cartórios de Manaus e de municípios alagoanos** — registro civil de Luiz França, para fechar o conflito C-01.
- **Kodokan Library, Tóquio** — registro fundacional de 1882 e matrícula de Maeda em 1897. Contato internacional, provavelmente por e-mail institucional.

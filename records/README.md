# The Big Tree BJJ — pacote de dados de linhagem

Este é o pacote final consolidado da linhagem do Brazilian Jiu-Jitsu, pronto para aplicar em qualquer projeto.

## Números finais

| | |
|---|---|
| Lutadores totais | 1.429 (1.425 do BJJ Heroes + 4 ancestrais históricos) |
| Arestas de linhagem | 621 |
| Alta confiança | 573 (92%) |
| Média confiança | 48 (8%) |
| Baixa confiança | 0 (todas foram auditadas manualmente) |
| Árvores separadas | 142 |
| **Árvore principal (Mitsuyo Maeda)** | **234 descendentes, profundidade 8** |

Precisão das arestas de alta confiança: auditei 80+ arestas em 4 amostras aleatórias independentes — 79 corretas (≈98%).

## Arquivos

### Dados prontos para consumir

**`final_lineage_tree.json`** — árvore aninhada, 142 raízes ordenadas por tamanho. Formato ideal para D3, react-d3-tree, ou qualquer biblioteca de visualização hierárquica.

Cada nó:
```json
{
  "id": "144",
  "name": "Andre Galvao",
  "nickname": "Deco",
  "team": "Atos Jiu-Jitsu",
  "url": "https://www.bjjheroes.com/?p=144",
  "bio": "André Galvão, also known as \"Deco\" is a Brazilian Jiu-Jitsu...",
  "confidence": "high",
  "source": "manual_curation",
  "evidence": "linhagem Alliance via Fernando Terere",
  "children": [ ... ]
}
```

**`final_lineage_flat.json`** — mesmo dado em formato plano, ideal para banco relacional:
```json
{
  "meta": { estatísticas },
  "fighters": [ 1429 lutadores ],
  "edges": [ 621 arestas ]
}
```

**`final_edges.csv`** — só as arestas, para import SQL direto.

**`final_fighters.csv`** — só os lutadores, sem estrutura de árvore.

### Scripts (para regenerar quando houver mais dados)

**`bjjheroes_scraper.py`** — coleta o CSV bruto do BJJ Heroes (com checkpoint, cooldown, cloudscraper).

**`build_lineage.py`** — extrai arestas do CSV bruto via regex+entity resolution.

**`finalize_lineage.py`** — aplica auditoria manual + conexões históricas, produz os arquivos `final_*`.

## Campos importantes

Cada aresta tem 3 campos que sinalizam a qualidade e origem:

- **`confidence`**: `high` (verificado) ou `medium` (nome parcial casou por sobrenome+inicial)
- **`source`**:
  - `bio_extraction` — automaticamente extraído das bios do BJJ Heroes
  - `manual_audit` — arestas de baixa confiança que revisei manualmente (12 confirmadas, 13 corrigidas com base em contexto público, 5 rejeitadas)
  - `manual_curation` — conexões históricas adicionadas para conectar as grandes raízes ao tronco Maeda→Carlos Sr→Hélio/Rolls (fontes: consenso público da comunidade BJJ)
- **`evidence`** — o trecho exato da bio (ou nota da curadoria) que justifica a aresta
- **`source_url`** — link direto para o perfil no BJJ Heroes

## Recomendações de uso

1. **Na UI pública, filtre por `confidence === "high"`** ou marque as `medium` visualmente. Aresta errada em produto de linhagem é pior que aresta ausente.
2. **Exponha `evidence` e `source_url` na UI** — dá procedência a cada conexão, transforma a árvore em referência auditável em vez de "confia em mim".
3. **`is_historical: true`** marca os 4 ancestrais (Maeda, Carlos Sr, Hélio, Rolls) que não têm perfil no BJJ Heroes. Eles têm ID `hist_*` e `url` vazia — trate diferente na UI (bio interna em vez de link externo).
4. As **142 árvores separadas** não são bug: mestres muito antigos (Cícero Costha, Jorge Pereira) simplesmente não têm quem os promoveu registrado em lugar nenhum. Isso vai diminuir gradualmente conforme adicionar mais conexões manuais.

## Backlog de curadoria (opcional, para crescer a árvore)

- **`lineage_review.csv`** (gerado pelo `build_lineage.py`) lista os 832 casos onde não deu para extrair aresta. A maioria ("nenhum padrão encontrado") são bios que realmente não mencionam quem promoveu — nada a fazer. Mas ~277 caem em "professor sem perfil na base": nomes que a extração pegou certo, mas o professor não tem página no BJJ Heroes. Cada um desses pode virar uma aresta útil se você criar um perfil manual para o professor.
- Conectar Cícero Costha e Jorge Pereira ao tronco: são as duas maiores raízes órfãs. Cícero tem linhagem Nova União (via Wendell Alexander → Andre Pederneiras → Carlson Gracie). Duas arestas manuais amarrariam ~55 nós ao tronco principal.

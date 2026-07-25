# LineageTree — a visão "clean" em SVG

Substitui (ou convive com) o LineageCanvas WebGL. Layout tidy vertical:
cadeia de ancestrais em coluna acima do lutador, alunos em árvore abaixo —
o desenho da tua referência original. Texto nítido em qualquer zoom, motion
via CSS, zero dependências novas (nem d3: o layout é próprio, testado).

## Arquivos

```
src/app/explore/tree/
├── lineageTreeLayout.ts   layout puro (testado com node: posições, ciclos, bbox)
├── LineageTree.tsx        componente SVG (zoom/pan/fly-to, cards, trace)
└── lineage-tree.css       anexar ao globals.css
```

## Integração no page.tsx

1. Import:

```tsx
import LineageTree from "./tree/LineageTree";
import { useLineageTrace } from "./canvas/useLineageTrace"; // do FX pack anterior
```

2. Dentro do componente (depois de `selected`):

```tsx
const trace = useLineageTrace(selected);
```

3. Trocar o bloco do canvas:

```tsx
<div className="lineage-webgl-wrap">
  <LineageTree
    nodes={nodes}
    links={visibleLinks}
    rootId={rootId}
    selectedId={selected?.id ?? rootId}
    pathIds={trace.pathIds}
    traceT0={trace.traceT0}
    onSelectNode={selectNode}
    onPositions={setSimPositions}
  />
  ...
</div>
```

`onPositions` continua alimentando teu minimap (posições normalizadas 0–100,
mesmo contrato do force sim). `selectNode` continua disparando a expansão via
API quando o nó é `expandable` — nada muda no fluxo de dados.

4. Anexar `lineage-tree.css` ao `globals.css` e (agora sim) apagar as duas
   regras `transform: scale(var(--tree-zoom))` — o zoom vive no componente.

5. Como o layout agora é determinístico, o `useForceLayout` deixa de ser
   necessário nesta visão. Se quiser manter o WebGL como modo alternativo,
   o seletor `viewMode` que já existe é o lugar: "clean" (LineageTree) /
   "immersive" (LineageCanvas). Os dois aceitam pathIds/traceT0.

## O que o componente faz

- Zoom no cursor (wheel), pan (drag), fly-to animado no select (cubic ease).
- Cards com avatar (foto se o nó tiver `photo`; senão iniciais), nome em até
  2 linhas, equipe visível a partir de ~62% de zoom (zoom semântico).
- Trace de linhagem: com pathIds/traceT0, o caminho raiz→pessoa acende elo
  por elo (transition-delay indexado — o timing é 100% CSS) e o resto cai a
  15%/8% de opacidade. Sem cadeia, nada escurece.
- Ancestrais têm anel azulado sutil (mesma convenção do resto do produto para
  conexão histórica/curadoria).
- Badge "+" nos nós `expandable && !loaded` (o clique no card já dispara tua
  expansão via selectNode).
- `prefers-reduced-motion`: transições desligadas.

## Limitações conhecidas (deliberadas)

- A cadeia de ancestrais segue o PRIMEIRO professor quando há mais de um
  (multi-professor vira decisão de UI futura — hoje o dado extra continua nos
  links e no painel de detalhe).
- Nós do grafo não alcançáveis a partir do root pela direção professor→aluno
  (ex.: entidades "source"/"team" laterais do teu API) ficam fora desta visão —
  ela é sobre pessoas e linhagem. Se quiser, um chip "N conexões laterais" no
  card é o próximo passo natural.
- Sem minimapa próprio (o teu, no page.tsx, continua funcionando via
  onPositions).

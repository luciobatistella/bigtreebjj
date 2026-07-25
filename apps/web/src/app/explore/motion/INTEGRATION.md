# MotionTree — o motion proto dentro do teu Next

Porte fiel do bigtree-motion-proto.html como componente React (canvas 2D):
brasas, pulsos de energia, trace de linhagem acendendo elo por elo, órbes
douradas, modo história cinematográfico com letterbox. Consome teu API atual
(nodes + links), expansão continua via page.tsx.

⚠️ NADA MUDA NA TELA ATÉ FAZER OS 4 PASSOS ABAIXO. São arquivos para copiar
dentro do projeto + 1 edição no page.tsx + 1 no globals.css.

## Conteúdo do zip

```
src/app/explore/motion/MotionTree.tsx     o componente (canvas 2D + cinema)
src/app/explore/motion/motion-tree.css    estilos (tooltip, letterbox, legenda)
src/app/explore/tree/lineageTreeLayout.ts dependência: layout puro (testado)
```

## Passo 1 — copiar os arquivos

Copiar as duas pastas para dentro de `src/app/explore/` do teu projeto,
mantendo os caminhos acima. (Se a pasta `tree/` já existe do pacote anterior,
só confirma que `lineageTreeLayout.ts` está lá.)

## Passo 2 — anexar o CSS

Colar o conteúdo de `motion-tree.css` no FINAL de `src/app/globals.css`.

E APAGAR estas duas linhas que existem no globals.css (~168 e ~761):

```css
transform: scale(var(--tree-zoom));
```

(zoom duplo — o componente já tem câmera própria com zoom no cursor)

## Passo 3 — editar src/app/explore/page.tsx

a) Trocar o import do canvas (topo do arquivo):

```tsx
// REMOVER:
const LineageCanvas = dynamic(() => import("./canvas/LineageCanvas"), { ... });

// ADICIONAR (import direto — o componente é SSR-safe, e dynamic não
// encaminha ref):
import MotionTree, { type MotionTreeHandle } from "./motion/MotionTree";
```

b) Criar o ref (junto dos outros useState/useRef):

```tsx
const treeRef = useRef<MotionTreeHandle>(null);
```

(garantir `useRef` no import do react)

c) Substituir o bloco `<LineageCanvas ... />` por:

```tsx
<MotionTree
  ref={treeRef}
  nodes={nodes}
  links={visibleLinks}
  rootId={rootId}
  selectedId={selected?.id ?? rootId}
  onSelectNode={selectNode}
  onPositions={setSimPositions}
/>
```

d) Trocar o botão "Play Lineage Story" no painel de detalhe:

```tsx
// ANTES:
onClick={() => story.start(selected.entityId!).catch(() => undefined)}

// DEPOIS:
onClick={() => treeRef.current?.playStory(selected.id)}
```

## Passo 4 — rodar

`npm run dev` e abrir /explore. Para o teste completo: buscar alguém fundo na
árvore, clicar, ver o caminho acender até a raiz; depois "Play Lineage Story"
para o modo cinema (ESC sai).

## Limpeza opcional (depois de validar)

- `<StoryModeBar ... />` e o hook `useStorySequence` podem sair — o cinema
  interno do MotionTree os substitui (a cadeia agora é local, sem fetch).
- A pasta `canvas/` inteira e as deps `three`, `@react-three/*`,
  `postprocessing`, `d3-force`, `gsap` podem sair do package.json
  (~600 KB a menos no bundle).
- Os botões de zoom da toolbar mexiam no `--tree-zoom` (removido); o zoom
  agora é scroll no canvas. Se quiser os botões funcionando, me pede que eu
  exponho `zoomIn/zoomOut` no handle.

## Notas

- Layout: ancestrais em coluna acima do lutador central, alunos em árvore
  abaixo (o grafo do teu API tem professores acima — o proto original era
  árvore pura de cima pra baixo; esta é a adaptação correta ao teu modelo).
- Nós novos da expansão via API nascem da posição do pai com pop escalonado.
- Trace recalculado localmente pela cadeia de pais — instantâneo, sem fetch.
- Fotos: quando o nó tiver campo `photo`, dá pra ligar no desenho da órbita —
  hoje iniciais (aguardando teu --step enrich).
- `prefers-reduced-motion` desliga brasas e pulsos.
- Fonte: usa "Fraunces" se carregada (adicionar via next/font no layout.tsx
  para o visual exato do proto); senão cai em Georgia.

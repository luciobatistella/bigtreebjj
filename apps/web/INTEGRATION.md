# FX Pack — integração no The Big Tree

Efeitos prontos para o teu stack (R3F 8.17 / three 0.169 / drei 9.114 / postprocessing).
Tudo typecheckado com `tsc --strict` contra essas versões. Nenhuma dependência nova.

## Arquivos

```
src/app/explore/canvas/
├── fx/
│   ├── gold.ts          NOVO — paleta, sprite de glow, bézier, timing do trace
│   ├── Embers.tsx       NOVO — brasas subindo (aditivo, respeita reduced-motion)
│   └── LinkPulses.tsx   NOVO — pulsos de energia nos links, boost no caminho aceso
├── useLineageTrace.ts   NOVO — busca lineagePath do teu endpoint e expõe pathIds + t0
├── LinkCurve.tsx        SUBSTITUI — trace dourado sequencial + dim (props novas opcionais)
├── NodePortrait.tsx     SUBSTITUI — halo aditivo que floresce no Bloom + dim
└── LineageCanvas.tsx    SUBSTITUI — monta os efeitos e distribui as props de trace
```

`cinema.css` → anexar ao final de `src/app/globals.css`.

## Passo a passo

1. **Copiar os arquivos** por cima dos existentes (os três SUBSTITUI são
   compatíveis com o uso atual: todas as props novas são opcionais — se o
   page.tsx não passar nada, a cena se comporta como hoje, só com brasas
   e pulsos a mais).

2. **Corrigir o zoom duplo**: apagar `transform: scale(var(--tree-zoom));`
   das duas regras em `globals.css` (linhas ~168 e ~761). O zoom já vive no
   CameraRig. Depois disso o `--tree-zoom` no style do page.tsx pode sair
   também.

3. **Ligar o trace no page.tsx** (3 linhas):

   ```tsx
   import { useLineageTrace } from "./canvas/useLineageTrace";
   // dentro do componente, depois de `selected`:
   const trace = useLineageTrace(selected);
   // no JSX:
   <LineageCanvas
     ...props atuais...
     pathIds={trace.pathIds}
     traceT0={trace.traceT0}
   />
   ```

   Pronto: selecionar uma pessoa acende a cadeia raiz→pessoa elo por elo
   (~230 ms de stagger) e escurece o resto para 8–15 %. Usa o mesmo
   endpoint `GET /public/people/:id` do Story Mode — zero mudança de backend.

4. **Modo cinema no Story Mode** (opcional, recomendado):

   ```tsx
   // page.tsx — sincroniza a classe com o estado que o hook já expõe
   useEffect(() => {
     document.body.classList.toggle("cinema", story.steps.length > 0);
     return () => document.body.classList.remove("cinema");
   }, [story.steps.length]);
   ```

   E no JSX (irmãos do <main> ou dentro dele):

   ```tsx
   <div className="cinema-bar cinema-bar--top" />
   <div className="cinema-bar cinema-bar--bottom" />
   ```

   Com o CSS anexado, iniciar a história fecha o letterbox, esconde a UI e
   transforma a StoryModeBar existente em legenda de cinema serifada — sem
   tocar no componente StoryModeBar nem no useStorySequence.

5. **Fonte serifada (opcional)**: o CSS do cinema usa "Fraunces" com fallback
   Georgia. Para a fonte exata, adicionar no layout.tsx via next/font/google.

## Notas de comportamento

- `LinkPulses` recria os pulsos quando a lista de links ou o caminho muda
  (memo por `links` + `pathIds.join("|")`) — sem realocação por frame; as
  posições são escritas num Float32Array reutilizado.
- Tudo aditivo usa `toneMapped={false}` e cor acima do
  `luminanceThreshold: 0.35` do teu Bloom — é o composer existente que dá o
  glow, nada de pós novo.
- `reducedMotion` desliga brasas e pulsos por completo (return null), mantendo
  o trace estático (cor/opacidade) para acessibilidade.
- Sem cadeia (nó não-pessoa, ou fetch falhou): `pathIds` vira só o id
  selecionado e o dim não é aplicado (`tracing = pathIds.length > 1`).
- O `pathIndex` de cada elo usa o índice do nó mais fundo da aresta na cadeia,
  então a revelação corre da raiz para o selecionado.

## O que ficou de fora de propósito

- Fotos nos retratos: o `makePortraitTexture` continua com iniciais até o teu
  `--step enrich` do scraper popular as URLs de foto; aí é trocar a textura por
  `useTexture(photoUrl)` com o mesmo recorte circular.
- Entrada com stagger dos nós expandidos: o teu force sim já dá um nascimento
  orgânico (nós nascem no centro e se acomodam); um pop de escala por nó novo
  é fácil de adicionar depois no NodePortrait (campo `birth`), mas preferi não
  mexer no contrato do simRef nesta rodada.

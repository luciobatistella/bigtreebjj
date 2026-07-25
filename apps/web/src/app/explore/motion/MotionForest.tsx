"use client";

import { useEffect, useRef, useState } from "react";
import { explorerCopy } from "../../i18n/explorerCopy";
import type { Locale } from "../../i18n/locale";
import "./motion-forest.css";

/**
 * MotionForest — porte fiel do bigtree-motion-proto.html para o app.
 *
 * Canvas 2D fullscreen: órbes douradas, brasas subindo, pulsos de energia nos
 * elos, trace de linhagem que acende elo a elo, colapso/expansão com badge
 * "+N", seletor de árvore, busca global e modo história cinematográfico
 * (letterbox + legenda). Dados reais via GET /explore/forest — a floresta
 * inteira (Maeda com ~370 descendentes + raízes órfãs), carregada uma vez.
 *
 * A lógica do protótipo vive intencionalmente num único useEffect imperativo:
 * é um loop de render de canvas, não uma árvore de componentes — manter o
 * código na forma original facilita comparar com o proto e ajustar timing.
 */

type ForestNode = {
  id: string;
  name: string;
  nickname?: string;
  team?: string;
  url?: string;
  bio?: string;
  confidence?: string;
  source?: string;
  evidence?: string;
  relationLabel?: string;
  profileHref?: string;
  connections?: ForestConnection[];
  children?: ForestNode[];
};

type ForestConnection = {
  id: string;
  name: string;
  label: string;
  evidence?: string;
  confidence?: string;
};

type TreeNodeM = {
  id: string;
  name: string;
  nickname: string;
  team: string;
  url: string;
  bio: string;
  confidence: string;
  source: string;
  evidence: string;
  relationLabel: string;
  profileHref: string;
  connections: ForestConnection[];
  children: TreeNodeM[] | null;
  _children: TreeNodeM[] | null;
  parent: TreeNodeM | null;
  x: number;
  y: number;
  sx: number;
  sy: number;
  birth: number;
  _badgeY?: number;
  _badgeW?: number;
};

const NODE_R = 21; // usado no modo compacto (zoom longe) e no hit-test mínimo
const CARD_W = 148;
const CARD_H = 108;
const AVATAR_R = 21;
const LEVEL_H = 204;
const SLOT_W = 170;
// abaixo deste zoom os cards viram órbes compactas (texto ilegível não ajuda ninguém)
const CARD_MIN_K = 0.4;

function treeSizeRaw(src: ForestNode): number {
  return 1 + (src.children ?? []).reduce((acc, child) => acc + treeSizeRaw(child), 0);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => w.length > 1 && w[0] === w[0].toUpperCase())
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || (name[0] ?? "?").toUpperCase()
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function splitName(name: string): [string, string?] {
  if (name.length <= 15) return [name];
  const words = name.split(" ");
  if (words.length < 2) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function MotionForest({ locale }: { locale: Locale }) {
  const copy = explorerCopy[locale];
  const numberLocale = locale === "en" ? "en-US" : "pt-BR";
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const treeSelRef = useRef<HTMLSelectElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchResRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const crumbRef = useRef<HTMLDivElement>(null);
  const zoomPctRef = useRef<HTMLSpanElement>(null);
  const zoomInRef = useRef<HTMLButtonElement>(null);
  const zoomOutRef = useRef<HTMLButtonElement>(null);
  const zoomHelpRef = useRef<HTMLButtonElement>(null);
  const parentRef = useRef<HTMLButtonElement>(null);
  const rootButtonRef = useRef<HTMLButtonElement>(null);
  const fitRef = useRef<HTMLButtonElement>(null);
  const selectedInitialsRef = useRef<HTMLSpanElement>(null);
  const selectedLabelRef = useRef<HTMLSpanElement>(null);
  const selectedMetaRef = useRef<HTMLElement>(null);
  const joinSelectionRef = useRef<HTMLAnchorElement>(null);
  const detailOpenRef = useRef<HTMLButtonElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const capNameRef = useRef<HTMLElement>(null);
  const capSubRef = useRef<HTMLElement>(null);
  const storyExitRef = useRef<HTMLButtonElement>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    const cleanups: Array<() => void> = [];

    (async () => {
      let forest: ForestNode[] = [];
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15_000);
        const response = await fetch(`/api/explore/forest?locale=${locale}`, {
          cache: "no-store",
          signal: controller.signal
        });
        window.clearTimeout(timeout);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? copy.apiStatusError(response.status));
        }
        const payload = (await response.json()) as ForestNode[];
        // só árvores com linhagem de verdade (2+ pessoas) — singletons não têm o que desenhar
        forest = payload.filter((tree) => treeSizeRaw(tree) >= 2);
      } catch (error) {
        if (!disposed) {
          setErrorMessage(
            error instanceof DOMException && error.name === "AbortError"
              ? copy.timeoutError
              : error instanceof Error
                ? error.message
                : copy.unknownError
          );
          setStatus("error");
        }
        return;
      }
      if (disposed || !forest.length) {
        if (!disposed) {
          if (!forest.length) setErrorMessage(copy.emptyError);
          setStatus(forest.length ? "ready" : "error");
        }
        return;
      }
      setStatus("ready");

      const rootEl = rootRef.current!;
      const cv = canvasRef.current!;
      const ctx = cv.getContext("2d")!;
      const tip = tipRef.current!;
      const detailEl = detailRef.current!;
      const detailBody = detailBodyRef.current!;
      const treeSel = treeSelRef.current!;
      const searchIn = searchRef.current!;
      const searchRes = searchResRef.current!;
      const compactQuery = window.matchMedia("(max-width: 860px)");
      const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
      let isCompactUI = compactQuery.matches;
      let lastPointerType = coarsePointerQuery.matches ? "touch" : "mouse";
      const onCompactChange = (event: MediaQueryListEvent) => {
        isCompactUI = event.matches;
      };
      compactQuery.addEventListener("change", onCompactChange);
      cleanups.push(() => compactQuery.removeEventListener("change", onCompactChange));
      requestAnimationFrame(() => rootEl.classList.add("mt-ready"));

      /* ============ dados / árvore lógica ============ */
      let TREE: TreeNodeM = null as unknown as TreeNodeM;
      let currentTreeIndex = 0;
      let layoutDirty = true;

      function cloneTree(src: ForestNode, depth = 0, collapseAt = 3): TreeNodeM {
        const node: TreeNodeM = {
          id: String(src.id),
          name: src.name,
          nickname: src.nickname ?? "",
          team: src.team ?? "",
          url: src.url ?? "",
          bio: src.bio ?? "",
          confidence: src.confidence ?? "root",
          source: src.source ?? "root",
          evidence: src.evidence ?? "",
          relationLabel: src.relationLabel ?? "",
          profileHref: src.profileHref ?? "",
          connections: src.connections ?? [],
          children: null,
          _children: null,
          parent: null,
          x: 0,
          y: 0,
          sx: 0,
          sy: 0,
          birth: 0
        };
        const kids = (src.children ?? []).map((child) => cloneTree(child, depth + 1, collapseAt));
        kids.forEach((kid) => {
          kid.parent = node;
        });
        if (kids.length) {
          if (depth >= collapseAt) node._children = kids;
          else node.children = kids;
        }
        return node;
      }
      const visit = (n: TreeNodeM, fn: (n: TreeNodeM) => void) => {
        fn(n);
        (n.children ?? []).forEach((c) => visit(c, fn));
      };
      const visitAll = (n: TreeNodeM, fn: (n: TreeNodeM) => void) => {
        fn(n);
        (n.children ?? n._children ?? []).forEach((c) => visitAll(c, fn));
      };
      const findNodeById = (n: TreeNodeM, id: string): TreeNodeM | null => {
        if (n.id === id) return n;
        for (const child of n.children ?? n._children ?? []) {
          const match = findNodeById(child, id);
          if (match) return match;
        }
        return null;
      };
      const countAll = (n: TreeNodeM): number =>
        (n.children ?? n._children ?? []).reduce((sum, c) => sum + 1 + countAll(c), 0);

      function layout() {
        let cursor = 0;
        (function place(n: TreeNodeM, depth: number) {
          n.y = depth * LEVEL_H;
          const kids = n.children ?? [];
          if (!kids.length) {
            n.x = cursor;
            cursor += SLOT_W;
            return;
          }
          kids.forEach((k) => place(k, depth + 1));
          n.x = (kids[0].x + kids[kids.length - 1].x) / 2;
        })(TREE, 0);
        const off = TREE.x;
        visit(TREE, (n) => {
          n.x -= off;
        });
        layoutDirty = false;
      }

      /* ============ canvas / câmera ============ */
      let W = 0;
      let H = 0;
      let DPR = 1;
      let vignette: HTMLCanvasElement | null = null;

      function makeVignette() {
        vignette = document.createElement("canvas");
        vignette.width = Math.max(1, W);
        vignette.height = Math.max(1, H);
        const g = vignette.getContext("2d")!;
        const grad = g.createRadialGradient(W / 2, H * 0.38, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.55)");
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
      }
      function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        cv.width = W * DPR;
        cv.height = H * DPR;
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
        makeVignette();
      }
      window.addEventListener("resize", resize);
      cleanups.push(() => window.removeEventListener("resize", resize));

      const cam = { x: 0, y: 220, k: 0.85, tx: 0, ty: 220, tk: 0.85 };
      const camFlyTo = (x: number, y: number, k?: number) => {
        cam.tx = x;
        cam.ty = y;
        if (k) cam.tk = k;
      };
      const focusNode = (node: TreeNodeM, requestedZoom?: number) => {
        const zoom = requestedZoom ?? (isCompactUI ? Math.max(cam.tk, 1.08) : Math.min(1.12, Math.max(cam.tk, 0.82)));
        const mobileSheetOffset = isCompactUI ? (H * 0.2) / zoom : 0;
        camFlyTo(node.x, node.y + mobileSheetOffset, zoom);
      };

      /* enquadra o subtree visível de n (ele + filhos revelados) dentro do
         viewport atual, em vez de um zoom fixo -- uma fileira de 17 irmãos
         precisa de um zoom bem diferente numa tela 1440px vs 4K. */
      function boundsOf(n: TreeNodeM) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        visit(n, (d) => {
          minX = Math.min(minX, d.x);
          maxX = Math.max(maxX, d.x);
          minY = Math.min(minY, d.y);
          maxY = Math.max(maxY, d.y);
        });
        return { minX, maxX, minY, maxY };
      }
      function camFlyToFit(n: TreeNodeM) {
        const b = boundsOf(n);
        const spanX = b.maxX - b.minX + CARD_W * 1.8;
        const spanY = b.maxY - b.minY + CARD_H * 3;
        const hasMobileSheet = isCompactUI && detailEl.classList.contains("mt-show");
        const chromeX = isCompactUI ? 28 : Math.min(W * 0.4, 620);
        const chromeY = isCompactUI
          ? hasMobileSheet
            ? H * 0.6
            : 154
          : Math.min(H * 0.35, 260);
        const kx = Math.max(W - chromeX, 260) / Math.max(spanX, 1);
        const ky = Math.max(H - chromeY, 220) / Math.max(spanY, 1);
        const k = Math.min(kx, ky, 1.05);
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2 - LEVEL_H * 0.15;
        const sheetOffset = hasMobileSheet ? (H * 0.2) / Math.max(k, 0.35) : 0;
        camFlyTo(cx, cy + sheetOffset, Math.max(k, 0.16));
      }
      const worldToScreen = (x: number, y: number): [number, number] => [(x - cam.x) * cam.k + W / 2, (y - cam.y) * cam.k + H / 2];
      const screenToWorld = (px: number, py: number): [number, number] => [(px - W / 2) / cam.k + cam.x, (py - H / 2) / cam.k + cam.y];

      /* pan/zoom */
      let dragging = false;
      let dragMoved = false;
      let lx = 0;
      let ly = 0;
      const activePointers = new Map<number, { x: number; y: number }>();
      let pinchStartDistance = 0;
      let pinchStartZoom = cam.tk;
      let pinchWorldX = 0;
      let pinchWorldY = 0;
      const pointerPair = () => Array.from(activePointers.values()).slice(0, 2);
      const beginPinch = () => {
        const [a, b] = pointerPair();
        if (!a || !b) return;
        pinchStartDistance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        pinchStartZoom = cam.tk;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        [pinchWorldX, pinchWorldY] = screenToWorld(midX, midY);
      };
      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        lastPointerType = e.pointerType;
        const startsGesture = activePointers.size === 0;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dragging = true;
        if (startsGesture) dragMoved = false;
        if (activePointers.size === 1) {
          lx = e.clientX;
          ly = e.clientY;
        } else {
          dragMoved = true;
          beginPinch();
        }
        cv.classList.add("mt-dragging");
        cv.setPointerCapture?.(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (activePointers.has(e.pointerId)) {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (dragging) {
          if (activePointers.size >= 2) {
            const [a, b] = pointerPair();
            if (!a || !b) return;
            const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const nk = Math.min(2.4, Math.max(0.16, pinchStartZoom * (distance / pinchStartDistance)));
            cam.tk = nk;
            cam.tx = pinchWorldX - (midX - W / 2) / nk;
            cam.ty = pinchWorldY - (midY - H / 2) / nk;
            cam.x = cam.tx;
            cam.y = cam.ty;
            cam.k = cam.tk;
            return;
          }
          const dx = e.clientX - lx;
          const dy = e.clientY - ly;
          if (Math.abs(dx) + Math.abs(dy) > (e.pointerType === "touch" ? 8 : 3)) dragMoved = true;
          cam.x -= dx / cam.k;
          cam.y -= dy / cam.k;
          cam.tx = cam.x;
          cam.ty = cam.y;
          lx = e.clientX;
          ly = e.clientY;
        } else {
          hover(e.clientX, e.clientY);
        }
      };
      const onPointerUp = (e: PointerEvent) => {
        activePointers.delete(e.pointerId);
        dragging = activePointers.size > 0;
        pinchStartDistance = 0;
        if (activePointers.size === 1) {
          const remaining = activePointers.values().next().value as { x: number; y: number } | undefined;
          if (remaining) {
            lx = remaining.x;
            ly = remaining.y;
          }
        } else if (!dragging) {
          cv.classList.remove("mt-dragging");
        }
        if (cv.hasPointerCapture?.(e.pointerId)) cv.releasePointerCapture(e.pointerId);
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.12 : 0.89;
        const [wx, wy] = screenToWorld(e.clientX, e.clientY);
        const nk = Math.min(2.4, Math.max(0.16, cam.tk * f));
        cam.tx = wx - (e.clientX - W / 2) / nk;
        cam.ty = wy - (e.clientY - H / 2) / nk;
        cam.tk = nk;
      };
      cv.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      cv.addEventListener("wheel", onWheel, { passive: false });
      cleanups.push(() => {
        cv.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        cv.removeEventListener("wheel", onWheel);
      });

      /* ============ sprites de glow / brasas ============ */
      function glowSprite(r: number, color: string): HTMLCanvasElement {
        const c = document.createElement("canvas");
        c.width = c.height = r * 2;
        const g = c.getContext("2d")!;
        const grad = g.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, r * 2, r * 2);
        return c;
      }
      const SP_GOLD = glowSprite(32, "rgba(232,192,120,0.9)");
      const SP_EMBER = glowSprite(16, "rgba(224,150,70,0.8)");
      const SP_HALO = glowSprite(90, "rgba(201,151,76,0.55)");

      const embers = Array.from({ length: 54 }, () => ({
        x: Math.random(),
        y: Math.random(),
        s: 0.5 + Math.random() * 1.4,
        vy: 0.006 + Math.random() * 0.02,
        ph: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.008
      }));
      type Ripple = { node: TreeNodeM; born: number; strong: boolean };
      const ripples: Ripple[] = [];
      function interactionFeedback(node: TreeNodeM, strong = false) {
        ripples.push({ node, born: performance.now(), strong });
        if (ripples.length > 12) ripples.shift();
        if (lastPointerType !== "mouse") navigator.vibrate?.(strong ? 18 : 8);
      }

      type Pulse = { a: TreeNodeM; b: TreeNodeM; t: number; speed: number };
      const pulses: Pulse[] = [];
      function seedPulses() {
        pulses.length = 0;
        visit(TREE, (n) => {
          (n.children ?? []).forEach((c) => {
            pulses.push({ a: n, b: c, t: Math.random(), speed: 0.0022 + Math.random() * 0.002 });
          });
        });
      }

      /* ============ seleção / trace ============ */
      let selected: TreeNodeM | null = null;
      let path: TreeNodeM[] = [];
      let pathSet = new Set<string>();
      let revealT0 = 0;
      const ancestors = (n: TreeNodeM): TreeNodeM[] => {
        const a: TreeNodeM[] = [];
        let c: TreeNodeM | null = n;
        while (c) {
          a.unshift(c);
          c = c.parent;
        }
        return a;
      };
      const isStructuralNode = (n: TreeNodeM) => n.id.startsWith("unified:");
      const lineageAncestors = (n: TreeNodeM) =>
        ancestors(n).filter((ancestor) => !isStructuralNode(ancestor));
      const lineageParent = (n: TreeNodeM) => {
        let parent = n.parent;
        while (parent && isStructuralNode(parent)) parent = parent.parent;
        return parent;
      };

      function syncNavigation(n: TreeNodeM) {
        const canJoinBranch = !isStructuralNode(n);
        if (parentRef.current) parentRef.current.disabled = !lineageParent(n);
        if (selectedInitialsRef.current) selectedInitialsRef.current.textContent = initialsOf(n.name);
        if (selectedLabelRef.current) selectedLabelRef.current.textContent = n.name;
        if (selectedMetaRef.current) {
          const branchSize = countAll(n);
          selectedMetaRef.current.textContent =
            n.team || (branchSize ? copy.branchPeople(branchSize.toLocaleString(numberLocale)) : copy.selectedPerson);
        }
        rootEl.classList.toggle("mt-can-join", canJoinBranch);
        if (joinSelectionRef.current && canJoinBranch) {
          joinSelectionRef.current.href = `/join?teacher=${encodeURIComponent(n.name)}`;
          joinSelectionRef.current.setAttribute(
            "aria-label",
            copy.requestConnection(n.name)
          );
        }
        detailOpenRef.current?.setAttribute("aria-label", copy.openDetailsFor(n.name));
      }

      function hideDetail() {
        detailEl.classList.remove("mt-show");
        rootEl.classList.remove("mt-detail-open");
      }

      function select(n: TreeNodeM, opts: { expand?: boolean; noCam?: boolean; showDetail?: boolean } = {}) {
        selected = n;
        const justExpanded = !!(n._children && opts.expand);
        if (justExpanded) {
          n.children = n._children;
          n._children = null;
          const t = performance.now();
          n.children!.forEach((k, i) => {
            visitAll(k, (d) => {
              d.birth = t + i * 70;
            });
            k.birth = t + i * 70;
          });
          layoutDirty = true;
          seedPulses();
        }
        path = ancestors(n);
        pathSet = new Set(path.map((p) => p.id));
        revealT0 = performance.now();
        rootEl.classList.add("mt-has-selection");
        if (!isCompactUI || opts.showDetail) renderDetail(n);
        else hideDetail();
        renderBreadcrumb(n);
        syncNavigation(n);
        if (!opts.noCam) {
          if (justExpanded) {
            // Resolve o novo centro antes de mover a câmera. Mantemos os cards
            // grandes e deixamos o usuário explorar lateralmente, sem reduzir
            // dezenas de pessoas a pontos minúsculos.
            layout();
            focusNode(n, isCompactUI ? 1 : undefined);
          } else {
            focusNode(n);
          }
        }
      }

      function revealAndSelect(id: string) {
        const target = findNodeById(TREE, id);
        if (!target) return;
        let ancestor = target.parent;
        while (ancestor) {
          if (ancestor._children) {
            ancestor.children = ancestor._children;
            ancestor._children = null;
          }
          ancestor = ancestor.parent;
        }
        layoutDirty = true;
        layout();
        seedPulses();
        select(target, { noCam: true });
        focusNode(target);
      }
      function clearSelection() {
        selected = null;
        path = [];
        pathSet.clear();
        rootEl.classList.remove("mt-has-selection");
        rootEl.classList.remove("mt-can-join");
        hideDetail();
        if (parentRef.current) parentRef.current.disabled = true;
        if (selectedLabelRef.current) selectedLabelRef.current.textContent = TREE?.name ?? copy.root;
        // a barra "você está aqui" continua de pé, só recua pra raiz da árvore atual
        renderBreadcrumb(TREE);
      }

      /* "você está aqui" — sempre visível, igual o site do Fábio Gurgel */
      function renderBreadcrumb(n: TreeNodeM) {
        const crumb = crumbRef.current;
        if (!crumb) return;
        const chain = lineageAncestors(n);
        if (!chain.length) {
          crumb.innerHTML = `<span class="mt-crumb-context">${copy.treeOverview}</span>`;
          return;
        }
        crumb.innerHTML = chain
          .map(
            (c, i) =>
              `${i ? '<span class="mt-crumb-sep">›</span>' : ""}<button type="button" class="mt-crumb${i === chain.length - 1 ? " mt-crumb-cur" : ""}" data-id="${escapeHtml(c.id)}"><span class="mt-crumb-num">${i + 1}</span>${escapeHtml(c.name)}</button>`
          )
          .join("");
        crumb.querySelectorAll<HTMLButtonElement>(".mt-crumb:not(.mt-crumb-cur)").forEach((btn) => {
          btn.addEventListener("click", () => {
            let found: TreeNodeM | null = null;
            visit(TREE, (x) => {
              if (x.id === btn.dataset.id) found = x;
            });
            if (found) select(found);
          });
        });
      }

      function toggleCollapse(n: TreeNodeM) {
        if (n.children) {
          n._children = n.children;
          n.children = null;
        } else if (n._children) {
          n.children = n._children;
          n._children = null;
          const t = performance.now();
          n.children.forEach((k, i) => {
            k.birth = t + i * 70;
          });
        }
        layoutDirty = true;
        seedPulses();
      }

      /* ============ hit test / hover ============ */
      let hovered: TreeNodeM | null = null;
      function nodeAt(px: number, py: number): TreeNodeM | null {
        const [wx, wy] = screenToWorld(px, py);
        let best: TreeNodeM | null = null;
        let bd = Number.POSITIVE_INFINITY;
        const touchPadding = (isCompactUI || coarsePointerQuery.matches ? 24 : 12) / Math.max(cam.k, 0.35);
        const halfW = cam.k >= CARD_MIN_K ? CARD_W / 2 + touchPadding : NODE_R + touchPadding;
        const halfH = cam.k >= CARD_MIN_K ? CARD_H / 2 + touchPadding : NODE_R + touchPadding;
        visit(TREE, (n) => {
          const dx = n.sx - wx;
          const dy = n.sy - wy;
          if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) return;
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = n;
          }
        });
        return best;
      }
      function hover(px: number, py: number) {
        const n = nodeAt(px, py);
        hovered = n;
        if (n && n !== selected) {
          const hidden = n._children ? countAll(n) : 0;
          tip.innerHTML = `<b>${escapeHtml(n.name)}</b>${n.nickname ? `<span>"${escapeHtml(n.nickname)}" · </span>` : ""}<span>${escapeHtml(n.team || "—")}</span>${hidden ? `<small>${copy.tapToOpen(hidden.toLocaleString(numberLocale))}</small>` : ""}`;
          tip.style.left = `${px + 16}px`;
          tip.style.top = `${py + 10}px`;
          tip.classList.add("mt-show");
          cv.style.cursor = "pointer";
        } else {
          tip.classList.remove("mt-show");
          if (!dragging) cv.style.cursor = "grab";
        }
      }
      function badgeAtScreen(px: number, py: number): TreeNodeM | null {
        let hit: TreeNodeM | null = null;
        visit(TREE, (n) => {
          if (!n._children || n._badgeY === undefined) return;
          const [sx] = worldToScreen(n.sx, n.sy);
          const dx = Math.abs(sx - px);
          const dy = Math.abs(n._badgeY - py);
          if (dx <= Math.max(24, (n._badgeW ?? 44) / 2 + 5) && dy <= 24) hit = n;
        });
        return hit;
      }
      const onClick = (e: MouseEvent) => {
        if (dragMoved) return;
        const b = badgeAtScreen(e.clientX, e.clientY);
        if (b) {
          interactionFeedback(b, true);
          select(b, { expand: true });
          return;
        }
        const n = nodeAt(e.clientX, e.clientY);
        if (n) {
          const opening = Boolean(n._children);
          interactionFeedback(n, opening);
          select(n, { expand: opening });
        }
        else if (!story.on) clearSelection();
      };
      cv.addEventListener("click", onClick);
      cleanups.push(() => cv.removeEventListener("click", onClick));

      /* ============ painel de detalhe ============ */
      function pillFor(n: TreeNodeM): [string, string] {
        if (n.source === "editorial_archive") {
          const editorialClass =
            n.confidence === "DOC"
              ? "mt-high"
              : n.confidence === "ATE"
                ? "mt-manual"
                : n.confidence === "TRA"
                  ? "mt-medium"
                  : "mt-status-root";
          return [
            editorialClass,
            n.confidence === "root"
              ? copy.editorialArchive
              : `${copy.editorialArchive} · ${n.confidence}`
          ];
        }
        if (n.source === "manual_curation") return ["mt-manual", copy.historicalCuration];
        if (n.source === "manual_audit") return ["mt-manual", copy.manualAudit];
        if (n.confidence === "high") return ["mt-high", copy.bioHigh];
        if (n.confidence === "medium") return ["mt-medium", copy.bioMedium];
        return ["mt-status-root", copy.lineageRoot];
      }
      function renderDetail(n: TreeNodeM) {
        const chain = lineageAncestors(n);
        const [pc, pt] = pillFor(n);
        const directChildren = n.children ?? n._children ?? [];
        const formed = directChildren.length;
        const branchSize = countAll(n);
        const branchIsOpen = Boolean(n.children);
        const formedLabel =
          n.source === "editorial_archive" || n.id.startsWith("unified:")
            ? copy.directConnections(formed)
            : copy.blackBeltsAwarded(formed);
        const teacher = n.parent && !isStructuralNode(n.parent) ? n.parent : null;
        detailBody.innerHTML = `
          <div class="mt-d-avatar">${escapeHtml(initialsOf(n.name))}</div>
          <p class="mt-d-name">${escapeHtml(n.name)}</p>
          ${n.nickname ? `<p class="mt-d-nick">"${escapeHtml(n.nickname)}"</p>` : ""}
          ${n.team ? `<p class="mt-d-team">${escapeHtml(n.team)}</p>` : ""}
          <span class="mt-d-status ${pc}">${pt}</span>
          ${
            branchSize
              ? `<button type="button" class="mt-branch-action ${branchIsOpen ? "mt-open" : ""}">
                   <span class="mt-branch-icon" aria-hidden="true">${branchIsOpen ? "−" : "+"}</span>
                   <span>
                     <strong>${branchIsOpen ? copy.collapseBranch : copy.exploreBranch}</strong>
                     <small>${copy.connectedPeople(branchSize.toLocaleString(numberLocale), branchSize === 1)}</small>
                   </span>
                   <span class="mt-branch-arrow" aria-hidden="true">→</span>
                 </button>`
              : ""
          }
          ${
            isStructuralNode(n)
              ? ""
              : `<a class="mt-join-tree-btn" href="/join?teacher=${encodeURIComponent(n.name)}">
                   <span>${copy.belongsToBranch}</span>
                   <small>${escapeHtml(copy.requestConnection(n.name))}</small>
                   <i aria-hidden="true">→</i>
                 </a>`
          }
          ${formed ? `<div class="mt-d-belts"><strong>${formed}</strong><span>${formedLabel}</span></div>` : ""}
          ${
            directChildren.length
              ? `<div class="mt-d-label">${copy.nextConnections}</div>
                 <div class="mt-child-grid">
                   ${directChildren
                     .slice(0, 8)
                     .map(
                       (child) =>
                         `<button type="button" data-id="${escapeHtml(child.id)}">
                            <span class="mt-child-avatar">${escapeHtml(initialsOf(child.name))}</span>
                            <span>${escapeHtml(child.name)}</span>
                          </button>`
                     )
                     .join("")}
                   ${
                     directChildren.length > 8
                       ? `<span class="mt-child-more">${copy.moreConnections(directChildren.length - 8)}</span>`
                       : ""
                   }
                 </div>`
              : ""
          }
          ${
            teacher
              ? `<div class="mt-d-label">${escapeHtml(n.relationLabel || copy.awardedBy)}</div>
                 <div class="mt-teacher-row" data-id="${escapeHtml(teacher.id)}">
                   <div class="mt-teacher-avatar">${escapeHtml(initialsOf(teacher.name))}</div>
                   <div>
                     <div class="mt-teacher-name">${escapeHtml(teacher.name)}</div>
                     ${teacher.team ? `<div class="mt-teacher-sub">${escapeHtml(teacher.team)}</div>` : ""}
                   </div>
                 </div>
                 ${n.evidence ? `<div class="mt-evbox">"${escapeHtml(n.evidence)}"</div>` : ""}`
              : ""
          }
          ${
            chain.length
              ? `<div class="mt-d-label">${copy.lineage}</div>
                 <ul class="mt-chain">
                   ${chain.map((c, i) => `<li class="${i === chain.length - 1 ? "mt-cur" : ""}" data-id="${escapeHtml(c.id)}"><span class="mt-chain-num">${i + 1}</span>${escapeHtml(c.name)}</li>`).join("")}
                 </ul>`
              : ""
          }
          ${
            n.connections.length
              ? `<div class="mt-d-label">${copy.otherConnections}</div>
                 <div class="mt-connections">
                   ${n.connections
                     .map(
                       (connection) =>
                         `<button type="button" data-id="${escapeHtml(connection.id)}">
                            <span>${escapeHtml(connection.name)}</span>
                            <small>${escapeHtml(connection.label)}${connection.confidence ? ` · ${escapeHtml(connection.confidence)}` : ""}</small>
                          </button>`
                     )
                     .join("")}
                 </div>`
              : ""
          }
          ${
            n.bio
              ? `<div class="mt-d-label">${copy.about}</div>
                 ${n.source === "editorial_archive" && copy.historicalContentNotice ? `<div class="mt-d-bio"><em>${copy.historicalContentNotice}</em></div>` : ""}
                 <div class="mt-d-bio">${escapeHtml(n.bio)}</div>`
              : ""
          }
          ${
            isStructuralNode(n)
              ? ""
              : `<a class="mt-profile-btn" href="${escapeHtml(n.profileHref || `/people/${slugify(n.name)}`)}">${n.source === "editorial_archive" ? copy.readHistoricalEntry : copy.viewFullProfile} →</a>`
          }
          ${chain.length ? `<button type="button" class="mt-story-btn">▶ &nbsp;${copy.playLineageStory}</button>` : ""}
        `;
        detailEl.classList.add("mt-show");
        rootEl.classList.add("mt-detail-open");
        detailBody.querySelector<HTMLButtonElement>(".mt-branch-action")?.addEventListener("click", () => {
          const opening = Boolean(n._children);
          interactionFeedback(n, opening);
          toggleCollapse(n);
          select(n, { noCam: true });
          layout();
          focusNode(n, isCompactUI ? 1 : undefined);
        });
        detailBody.querySelectorAll<HTMLButtonElement>(".mt-child-grid button[data-id]").forEach((button) => {
          button.addEventListener("click", () => revealAndSelect(button.dataset.id ?? ""));
        });
        detailBody.querySelectorAll<HTMLLIElement>(".mt-chain li:not(.mt-cur)").forEach((li) => {
          li.addEventListener("click", () => {
            let found: TreeNodeM | null = null;
            visit(TREE, (x) => {
              if (x.id === li.dataset.id) found = x;
            });
            if (found) select(found);
          });
        });
        detailBody.querySelector<HTMLDivElement>(".mt-teacher-row")?.addEventListener("click", () => {
          if (teacher) select(teacher);
        });
        detailBody.querySelectorAll<HTMLButtonElement>(".mt-connections button[data-id]").forEach((button) => {
          button.addEventListener("click", () => revealAndSelect(button.dataset.id ?? ""));
        });
        detailBody.querySelector<HTMLButtonElement>(".mt-story-btn")?.addEventListener("click", () => startStory(n));
      }
      const onDetailClose = () => {
        if (isCompactUI) hideDetail();
        else clearSelection();
      };
      detailCloseRef.current?.addEventListener("click", onDetailClose);
      cleanups.push(() => detailCloseRef.current?.removeEventListener("click", onDetailClose));
      const onDetailOpen = () => {
        if (!selected) return;
        renderDetail(selected);
        focusNode(selected, Math.max(cam.tk, 1));
      };
      detailOpenRef.current?.addEventListener("click", onDetailOpen);
      cleanups.push(() => detailOpenRef.current?.removeEventListener("click", onDetailOpen));

      /* bottom sheet: a alça fecha o detalhe com um gesto curto para baixo */
      const detailHandle = detailEl.querySelector<HTMLElement>(".mt-detail-handle");
      let sheetPointer = -1;
      let sheetStartY = 0;
      let sheetDragY = 0;
      const onSheetDown = (event: PointerEvent) => {
        if (!isCompactUI) return;
        sheetPointer = event.pointerId;
        sheetStartY = event.clientY;
        sheetDragY = 0;
        detailHandle?.setPointerCapture?.(event.pointerId);
        detailEl.classList.add("mt-sheet-dragging");
      };
      const onSheetMove = (event: PointerEvent) => {
        if (event.pointerId !== sheetPointer) return;
        sheetDragY = Math.max(0, event.clientY - sheetStartY);
        detailEl.style.setProperty("--mt-sheet-drag", `${Math.min(sheetDragY, 180)}px`);
      };
      const onSheetUp = (event: PointerEvent) => {
        if (event.pointerId !== sheetPointer) return;
        if (sheetDragY > 72) hideDetail();
        detailEl.style.removeProperty("--mt-sheet-drag");
        detailEl.classList.remove("mt-sheet-dragging");
        sheetPointer = -1;
        sheetDragY = 0;
      };
      detailHandle?.addEventListener("pointerdown", onSheetDown);
      window.addEventListener("pointermove", onSheetMove);
      window.addEventListener("pointerup", onSheetUp);
      window.addEventListener("pointercancel", onSheetUp);
      cleanups.push(() => {
        detailHandle?.removeEventListener("pointerdown", onSheetDown);
        window.removeEventListener("pointermove", onSheetMove);
        window.removeEventListener("pointerup", onSheetUp);
        window.removeEventListener("pointercancel", onSheetUp);
      });

      /* ============ modo história ============ */
      const story: { on: boolean; steps: TreeNodeM[]; idx: number; timer: number } = { on: false, steps: [], idx: 0, timer: 0 };
      function startStory(n: TreeNodeM) {
        story.steps = lineageAncestors(n);
        if (!story.steps.length) return;
        story.idx = 0;
        story.on = true;
        rootEl.classList.add("mt-cinema");
        select(story.steps[0], { noCam: true });
        storyStep();
      }
      function storyStep() {
        if (!story.on) return;
        const s = story.steps[story.idx];
        select(s, { noCam: true });
        camFlyTo(s.x, s.y, 1.05);
        if (capNameRef.current) capNameRef.current.textContent = s.name;
        if (capSubRef.current)
          capSubRef.current.textContent =
            (s.nickname ? `"${s.nickname}" · ` : "") + (s.team || "") + `  ·  ${copy.generation(story.idx + 1, story.steps.length)}`;
        story.idx += 1;
        story.timer = window.setTimeout(story.idx < story.steps.length ? storyStep : stopStory, story.idx < story.steps.length ? 1900 : 2600);
      }
      function stopStory() {
        story.on = false;
        window.clearTimeout(story.timer);
        rootEl.classList.remove("mt-cinema");
        if (story.steps.length) {
          const last = story.steps[story.steps.length - 1];
          select(last);
        }
      }
      const onStoryExit = () => stopStory();
      storyExitRef.current?.addEventListener("click", onStoryExit);
      const onKeyDown = (e: KeyboardEvent) => {
        const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
        if (e.key === "Escape") {
          if (story.on) stopStory();
          else if (document.activeElement === searchIn || searchRes.classList.contains("mt-show")) {
            searchRes.classList.remove("mt-show");
            searchIn.blur();
          }
          else {
            if (selected) clearSelection();
          }
          return;
        }
        if (typing) return;
        if (e.key === "/") {
          e.preventDefault();
          searchIn.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          clearSelection();
          camFlyToFit(TREE);
        } else if (e.key.toLowerCase() === "f") {
          camFlyToFit(selected ?? TREE);
        } else if (e.key === "ArrowUp" && selected && lineageParent(selected)) {
          e.preventDefault();
          const parent = lineageParent(selected)!;
          select(parent, { noCam: true });
          focusNode(parent, Math.max(cam.tk, 0.85));
        } else if (e.key === "+" || e.key === "=") {
          onZoomIn();
        } else if (e.key === "-") {
          onZoomOut();
        }
      };
      window.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        storyExitRef.current?.removeEventListener("click", onStoryExit);
        window.removeEventListener("keydown", onKeyDown);
        window.clearTimeout(story.timer);
      });

      /* ============ zoom / mini map / compartilhar ============ */
      const onZoomIn = () => {
        cam.tk = Math.min(2.4, cam.tk * 1.25);
      };
      const onZoomOut = () => {
        cam.tk = Math.max(0.16, cam.tk * 0.8);
      };
      const onZoomHelp = () => {
        const hint = hintRef.current;
        if (hint) hint.style.opacity = hint.style.opacity === "0" ? "1" : "0";
      };
      const onParent = () => {
        if (!selected) return;
        const parent = lineageParent(selected);
        if (!parent) return;
        select(parent, { noCam: true });
        focusNode(parent, Math.max(cam.tk, 0.85));
      };
      const onRoot = () => {
        clearSelection();
        camFlyToFit(TREE);
      };
      const onFit = () => camFlyToFit(selected ?? TREE);
      zoomInRef.current?.addEventListener("click", onZoomIn);
      zoomOutRef.current?.addEventListener("click", onZoomOut);
      zoomHelpRef.current?.addEventListener("click", onZoomHelp);
      parentRef.current?.addEventListener("click", onParent);
      rootButtonRef.current?.addEventListener("click", onRoot);
      fitRef.current?.addEventListener("click", onFit);
      cleanups.push(() => {
        zoomInRef.current?.removeEventListener("click", onZoomIn);
        zoomOutRef.current?.removeEventListener("click", onZoomOut);
        zoomHelpRef.current?.removeEventListener("click", onZoomHelp);
        parentRef.current?.removeEventListener("click", onParent);
        rootButtonRef.current?.removeEventListener("click", onRoot);
        fitRef.current?.removeEventListener("click", onFit);
      });

      let shareResetTimer = 0;
      const onShare = async () => {
        const btn = shareRef.current;
        const shareUrl = new URL(window.location.href);
        shareUrl.searchParams.set("tree", String(currentTreeIndex));
        if (selected) shareUrl.searchParams.set("person", selected.id);
        try {
          await navigator.clipboard.writeText(shareUrl.toString());
        } catch {
          /* clipboard indisponível — silencioso, o botão só não confirma */
        }
        if (btn) {
          const original = btn.textContent;
          btn.textContent = copy.linkCopied;
          btn.classList.add("mt-copied");
          window.clearTimeout(shareResetTimer);
          shareResetTimer = window.setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove("mt-copied");
          }, 1800);
        }
      };
      shareRef.current?.addEventListener("click", onShare);
      cleanups.push(() => {
        shareRef.current?.removeEventListener("click", onShare);
        window.clearTimeout(shareResetTimer);
      });

      const minimapCanvas = minimapRef.current;
      const minimapCtx = minimapCanvas?.getContext("2d") ?? null;
      function drawMinimap() {
        if (!minimapCanvas || !minimapCtx || !TREE) return;
        const mw = minimapCanvas.clientWidth || 214;
        const mh = minimapCanvas.clientHeight || 120;
        if (minimapCanvas.width !== mw || minimapCanvas.height !== mh) {
          minimapCanvas.width = mw;
          minimapCanvas.height = mh;
        }
        minimapCtx.clearRect(0, 0, mw, mh);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        visit(TREE, (n) => {
          minX = Math.min(minX, n.x);
          maxX = Math.max(maxX, n.x);
          minY = Math.min(minY, n.y);
          maxY = Math.max(maxY, n.y);
        });
        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const pad = 10;
        const scale = Math.min((mw - pad * 2) / spanX, (mh - pad * 2) / spanY);
        const toMini = (x: number, y: number): [number, number] => [
          pad + (x - minX) * scale + (mw - pad * 2 - spanX * scale) / 2,
          pad + (y - minY) * scale + (mh - pad * 2 - spanY * scale) / 2
        ];
        visit(TREE, (n) => {
          (n.children ?? []).forEach((c) => {
            const [ax, ay] = toMini(n.x, n.y);
            const [bx, by] = toMini(c.x, c.y);
            minimapCtx.strokeStyle = "rgba(201,151,76,0.28)";
            minimapCtx.lineWidth = 1;
            minimapCtx.beginPath();
            minimapCtx.moveTo(ax, ay);
            minimapCtx.lineTo(bx, by);
            minimapCtx.stroke();
          });
        });
        visit(TREE, (n) => {
          const [px, py] = toMini(n.x, n.y);
          const isSel = n === selected;
          minimapCtx.beginPath();
          minimapCtx.arc(px, py, isSel ? 3 : 1.6, 0, Math.PI * 2);
          minimapCtx.fillStyle = isSel ? "#e8c078" : pathSet.has(n.id) ? "rgba(232,192,120,0.8)" : "rgba(201,151,76,0.55)";
          minimapCtx.fill();
        });
        // viewport atual da câmera principal
        const corners: Array<[number, number]> = [
          [screenToWorld(0, 0)[0], screenToWorld(0, 0)[1]],
          [screenToWorld(W, H)[0], screenToWorld(W, H)[1]]
        ];
        const [vx0, vy0] = toMini(corners[0][0], corners[0][1]);
        const [vx1, vy1] = toMini(corners[1][0], corners[1][1]);
        minimapCtx.strokeStyle = "rgba(232,192,120,0.6)";
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(Math.min(vx0, vx1), Math.min(vy0, vy1), Math.abs(vx1 - vx0), Math.abs(vy1 - vy0));
      }

      /* ============ render ============ */
      function edgeColor(child: TreeNodeM, lit: boolean): string {
        if (lit) return "rgba(232,192,120,";
        const s = child.source;
        if (s === "manual_curation" || s === "manual_audit") return "rgba(123,158,201,";
        if (child.confidence === "DOC") return "rgba(95,156,118,";
        if (child.confidence === "ATE") return "rgba(123,158,201,";
        if (child.confidence === "TRA") return "rgba(201,143,76,";
        if (child.confidence === "ESP") return "rgba(107,98,85,";
        if (child.confidence === "high") return "rgba(95,156,118,";
        if (child.confidence === "medium") return "rgba(201,143,76,";
        return "rgba(138,106,52,";
      }
      function bezierPoint(ax: number, ay: number, bx: number, by: number, t: number): [number, number] {
        const my = (ay + by) / 2;
        const u = 1 - t;
        const x = u * u * u * ax + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * bx;
        const y = u * u * u * ay + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * by;
        return [x, y];
      }
      function pathReveal(child: TreeNodeM): number {
        if (!pathSet.has(child.id) || !child.parent) return 0;
        const idx = path.indexOf(child);
        const t = (performance.now() - revealT0 - (idx - 1) * 230) / 420;
        return Math.max(0, Math.min(1, t));
      }

      let fontsReady = false;
      document.fonts?.ready.then(() => {
        fontsReady = true;
      });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let frameCount = 0;
      function frame(now: number) {
        raf = requestAnimationFrame(frame);
        frameCount += 1;
        if (layoutDirty) layout();
        if (zoomPctRef.current && frameCount % 4 === 0) zoomPctRef.current.textContent = `${Math.round(cam.k * 100)}%`;
        if (frameCount % 4 === 0) drawMinimap();

        cam.x += (cam.tx - cam.x) * 0.085;
        cam.y += (cam.ty - cam.y) * 0.085;
        cam.k += (cam.tk - cam.k) * 0.085;

        visit(TREE, (n) => {
          if (n.sx === 0 && n.sy === 0 && n.parent) {
            n.sx = n.parent.sx;
            n.sy = n.parent.sy;
          }
          n.sx += (n.x - n.sx) * 0.12;
          n.sy += (n.y - n.sy) * 0.12;
        });

        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = "#0a0805";
        ctx.fillRect(0, 0, W, H);

        /* brasas */
        if (!reduced) {
          ctx.globalCompositeOperation = "lighter";
          embers.forEach((p) => {
            p.y -= p.vy / 60;
            p.x += p.drift / 60;
            p.ph += 0.02;
            if (p.y < -0.02) {
              p.y = 1.02;
              p.x = Math.random();
            }
            ctx.globalAlpha = 0.25 + 0.2 * Math.sin(p.ph);
            const s = p.s * 8;
            ctx.drawImage(SP_EMBER, p.x * W - s / 2, p.y * H - s / 2, s, s);
          });
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        const dimmed = false;
        const t = now * 0.001;
        const cardMode = cam.k >= CARD_MIN_K;
        const offY = cardMode ? CARD_H / 2 : NODE_R;

        /* resposta imediata ao toque/clique */
        for (let index = ripples.length - 1; index >= 0; index -= 1) {
          const ripple = ripples[index];
          const age = now - ripple.born;
          const duration = ripple.strong ? 1050 : 720;
          if (age >= duration) {
            ripples.splice(index, 1);
            continue;
          }
          const progress = age / duration;
          const [rx, ry] = worldToScreen(ripple.node.sx, ripple.node.sy);
          const radius = (24 + progress * (ripple.strong ? 92 : 58)) * Math.min(Math.max(cam.k, 0.75), 1.25);
          ctx.beginPath();
          ctx.arc(rx, ry, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(232,192,120,${(1 - progress) * (ripple.strong ? 0.72 : 0.45)})`;
          ctx.lineWidth = Math.max(1, (ripple.strong ? 3 : 2) * (1 - progress));
          ctx.stroke();
        }

        /* conexões alternativas: relações reais que não cabem em um único pai */
        const visibleById = new Map<string, TreeNodeM>();
        visit(TREE, (node) => visibleById.set(node.id, node));
        ctx.save();
        ctx.setLineDash([3, 6]);
        visit(TREE, (node) => {
          node.connections.forEach((connection) => {
            const target = visibleById.get(connection.id);
            if (!target) return;
            const [ax, ay] = worldToScreen(node.sx, node.sy);
            const [bx, by] = worldToScreen(target.sx, target.sy);
            const bend = Math.max(28, Math.abs(bx - ax) * 0.2);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.bezierCurveTo(ax + bend, ay, bx - bend, by, bx, by);
            ctx.strokeStyle = "rgba(123,158,201,0.28)";
            ctx.lineWidth = 1;
            ctx.stroke();
          });
        });
        ctx.restore();

        /* links */
        visit(TREE, (n) => {
          (n.children ?? []).forEach((c) => {
            const [ax, ay] = worldToScreen(n.sx, n.sy + offY);
            const [bx, by] = worldToScreen(c.sx, c.sy - offY);
            const lit = pathSet.has(c.id) && pathSet.has(n.id);
            const rv = pathReveal(c);
            let alpha = dimmed && !lit ? 0.12 : 0.5;
            if (lit) alpha = 0.25 + rv * 0.75;
            const col = edgeColor(c, lit && rv > 0);
            const my = (ay + by) / 2;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.bezierCurveTo(ax, my, bx, my, bx, by);
            ctx.strokeStyle = col + alpha + ")";
            ctx.lineWidth = (lit ? 2.4 : 1.3) * Math.min(cam.k, 1.2);
            if (
              !lit &&
              (c.confidence === "medium" ||
                c.confidence === "TRA" ||
                c.confidence === "ESP" ||
                c.source === "manual_curation" ||
                c.source === "manual_audit")
            ) ctx.setLineDash([6, 5]);
            else ctx.setLineDash([]);
            ctx.stroke();
            ctx.setLineDash([]);
            if (lit && rv > 0) {
              ctx.globalCompositeOperation = "lighter";
              ctx.globalAlpha = 0.35 * rv;
              ctx.lineWidth = 6 * Math.min(cam.k, 1.2);
              ctx.strokeStyle = "rgba(232,192,120,0.35)";
              ctx.stroke();
              ctx.globalAlpha = 1;
              ctx.globalCompositeOperation = "source-over";
            }
          });
        });

        /* pulsos */
        if (!reduced) {
          ctx.globalCompositeOperation = "lighter";
          pulses.forEach((p) => {
            if (!p.a.children || !p.a.children.includes(p.b)) return;
            const lit = pathSet.has(p.b.id) && pathSet.has(p.a.id);
            p.t += p.speed * (lit ? 2.6 : 1);
            if (p.t > 1) p.t = 0;
            if (dimmed && !lit) return;
            const [ax, ay] = worldToScreen(p.a.sx, p.a.sy + offY);
            const [bx, by] = worldToScreen(p.b.sx, p.b.sy - offY);
            const [px, py] = bezierPoint(ax, ay, bx, by, p.t);
            const s = (lit ? 22 : 11) * Math.min(cam.k, 1.3);
            ctx.globalAlpha = lit ? 0.9 : 0.45;
            ctx.drawImage(SP_GOLD, px - s / 2, py - s / 2, s, s);
          });
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        /* nós — cards (avatar + nome + equipe) ou órbes compactas no zoom longe */
        const roundRectPath = (x: number, y: number, w2: number, h2: number, rad: number) => {
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.arcTo(x + w2, y, x + w2, y + h2, rad);
          ctx.arcTo(x + w2, y + h2, x, y + h2, rad);
          ctx.arcTo(x, y + h2, x, y, rad);
          ctx.arcTo(x, y, x + w2, y, rad);
          ctx.closePath();
        };
        const drawBranchBadge = (n: TreeNodeM, sx: number, cy: number, hidden: number) => {
          const label = `+${hidden.toLocaleString("pt-BR")} abrir`;
          ctx.save();
          ctx.font = "700 10.5px Inter, sans-serif";
          const badgeW = Math.max(66, ctx.measureText(label).width + 26);
          const badgeH = 32;
          roundRectPath(sx - badgeW / 2, cy - badgeH / 2, badgeW, badgeH, badgeH / 2);
          const badgeGradient = ctx.createLinearGradient(0, cy - badgeH / 2, 0, cy + badgeH / 2);
          badgeGradient.addColorStop(0, "rgba(46,34,17,0.98)");
          badgeGradient.addColorStop(1, "rgba(22,16,8,0.98)");
          ctx.fillStyle = badgeGradient;
          ctx.fill();
          ctx.strokeStyle = "rgba(232,192,120,0.72)";
          ctx.lineWidth = 1.25;
          ctx.stroke();
          ctx.fillStyle = "#e8c078";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, sx, cy + 0.5);
          ctx.restore();
          n._badgeY = cy;
          n._badgeW = badgeW;
        };
        visit(TREE, (n) => {
          n._badgeY = undefined;
          n._badgeW = undefined;
          const [sx, sy] = worldToScreen(n.sx, n.sy);
          if (sx < -140 || sx > W + 140 || sy < -140 || sy > H + 140) return;
          const onPath = pathSet.has(n.id);
          const isSel = n === selected;
          const isHover = n === hovered && !coarsePointerQuery.matches;
          const born = n.birth ? Math.min(1, (now - n.birth) / 450) : 1;
          if (born <= 0) return;
          const pop = born < 1 ? (1 - Math.pow(1 - born, 3)) * (1 + 0.25 * Math.sin(born * Math.PI)) : 1;
          const ks = Math.min(cam.k, 1.35) * pop * (isHover ? 1.055 : 1);
          let alpha = dimmed && !onPath ? 0.16 : 1;
          alpha *= born;

          const strokeSel = "#e8c078";
          const strokeHist = "rgba(123,158,201,0.8)";
          const strokeBase = "#8a6a34";
          const ringColor = isSel || isHover ? strokeSel : n.id.startsWith("hist_") ? strokeHist : strokeBase;
          const serif = `${fontsReady ? "Fraunces" : "Georgia"}, serif`;

          if (isSel || isHover || (onPath && dimmed)) {
            const rv = isSel ? 1 : pathReveal(n) || (path.indexOf(n) === 0 ? 1 : 0);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = (isSel ? 0.5 + 0.16 * Math.sin(t * 3) : isHover ? 0.34 : 0.28) * Math.max(rv, isHover ? 1 : 0);
            const hs = (cardMode ? CARD_W * 2.1 : NODE_R * 4.6) * ks;
            ctx.drawImage(SP_HALO, sx - hs / 2, sy - hs / 2, hs, hs);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
          }

          ctx.globalAlpha = alpha;

          if (!cardMode) {
            /* ---- órbe compacta (zoom longe) ---- */
            const r = NODE_R * ks * (n.parent ? 1 : 1.25);
            const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.35, r * 0.2, sx, sy, r);
            g.addColorStop(0, "#2c2312");
            g.addColorStop(1, "#120e08");
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.lineWidth = isSel ? 2.6 : 1.6;
            ctx.strokeStyle = ringColor;
            ctx.stroke();
            if (cam.k > 0.3) {
              ctx.fillStyle = onPath || !dimmed ? "#e8c078" : "rgba(232,192,120,0.5)";
              ctx.font = `600 ${Math.max(9, r * 0.62)}px ${serif}`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(initialsOf(n.name), sx, sy + 1);
            }
            const hidden = n._children ? countAll(n) : 0;
            if (hidden && cam.k > 0.24) {
              drawBranchBadge(n, sx, sy + r + 23, hidden);
            }
            ctx.globalAlpha = 1;
            return;
          }

          /* ---- card ---- */
          const w2 = CARD_W * ks;
          const h2 = CARD_H * ks;
          const x0 = sx - w2 / 2;
          const y0 = sy - h2 / 2;

          const bg = ctx.createLinearGradient(x0, y0, x0, y0 + h2);
          bg.addColorStop(0, "#1c1509");
          bg.addColorStop(1, "#120e07");
          roundRectPath(x0, y0, w2, h2, 11 * ks);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.lineWidth = isSel ? 2.2 : 1.2;
          ctx.strokeStyle = isSel
            ? strokeSel
            : n.id.startsWith("hist_")
              ? "rgba(123,158,201,0.5)"
              : onPath && dimmed
                ? "rgba(232,192,120,0.55)"
                : "rgba(201,151,76,0.28)";
          ctx.stroke();

          /* avatar */
          const ar = AVATAR_R * ks;
          const acx = sx;
          const acy = y0 + (24 + AVATAR_R) * ks * 0.82;
          const ag = ctx.createRadialGradient(acx - ar * 0.3, acy - ar * 0.35, ar * 0.2, acx, acy, ar);
          ag.addColorStop(0, "#2c2312");
          ag.addColorStop(1, "#14100a");
          ctx.beginPath();
          ctx.arc(acx, acy, ar, 0, Math.PI * 2);
          ctx.fillStyle = ag;
          ctx.fill();
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = ringColor;
          ctx.stroke();
          ctx.fillStyle = "#e8c078";
          ctx.font = `600 ${Math.max(8, ar * 0.72)}px ${serif}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initialsOf(n.name), acx, acy + 1);

          /* nome (até 2 linhas) + equipe */
          const [line1, line2] = splitName(n.name);
          ctx.fillStyle = dimmed && !onPath ? "rgba(241,231,211,0.35)" : "#f1e7d3";
          ctx.font = `500 ${11 * ks}px ${serif}`;
          const nameY = acy + ar + 12 * ks;
          ctx.fillText(line1, sx, nameY);
          if (line2) ctx.fillText(line2, sx, nameY + 12 * ks);
          if (n.team) {
            ctx.fillStyle = dimmed && !onPath ? "rgba(107,98,85,0.4)" : "#6b6255";
            ctx.font = `400 ${8.5 * ks}px Inter, sans-serif`;
            const team = n.team.length > 22 ? `${n.team.slice(0, 21)}…` : n.team;
            ctx.fillText(team, sx, nameY + (line2 ? 24 : 13) * ks);
          }

          /* badge de expandir */
          const hidden = n._children ? countAll(n) : 0;
          if (hidden) {
            drawBranchBadge(n, sx, y0 + h2 + 20, hidden);
          }
          ctx.globalAlpha = 1;
        });

        if (vignette) ctx.drawImage(vignette, 0, 0);
      }

      /* ============ seletor de árvore + busca ============ */
      forest.forEach((s, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = `${s.name} (${treeSizeRaw(s)})`;
        treeSel.appendChild(o);
      });
      if (forest.length === 1) {
        treeSel.disabled = true;
        treeSel.classList.add("mt-single-tree");
        treeSel.setAttribute("aria-label", copy.unifiedTree);
      }
      const onTreeChange = () => loadForest(Number(treeSel.value));
      treeSel.addEventListener("change", onTreeChange);
      cleanups.push(() => treeSel.removeEventListener("change", onTreeChange));

      function loadForest(i: number) {
        currentTreeIndex = i;
        const src = forest[i];
        const n = treeSizeRaw(src);
        TREE = cloneTree(src, 0, n > 1000 ? 1 : n > 120 ? 2 : n > 40 ? 3 : 6);
        layoutDirty = true;
        clearSelection();
        layout();
        visit(TREE, (x) => {
          x.sx = x.x;
          x.sy = x.y;
        });
        seedPulses();
        // enquadra a raiz + o que já vem visível (o layout() de cima já rodou
        // de forma síncrona, então as posições estão corretas agora)
        camFlyToFit(TREE);
        cam.x = cam.tx;
        cam.y = cam.ty;
        cam.k = cam.tk;
        // Começa com a árvore livre. O painel só entra depois de uma escolha
        // intencional, especialmente no mobile onde ele ocupa boa parte da tela.
        clearSelection();
      }

      type IndexEntry = { n: ForestNode; ti: number };
      const INDEX: IndexEntry[] = [];
      forest.forEach((s, ti) => {
        (function flat(node: ForestNode) {
          INDEX.push({ n: node, ti });
          (node.children ?? []).forEach(flat);
        })(s);
      });
      let activeSearchIndex = -1;
      const refreshActiveSearchItem = () => {
        const items = Array.from(searchRes.querySelectorAll<HTMLElement>(".mt-item[data-id]"));
        items.forEach((item, index) => item.classList.toggle("mt-active", index === activeSearchIndex));
        items[activeSearchIndex]?.scrollIntoView({ block: "nearest" });
      };
      const onSearchInput = () => {
        const q = searchIn.value.trim().toLowerCase();
        activeSearchIndex = -1;
        if (!q) {
          searchRes.classList.remove("mt-show");
          return;
        }
        const m = INDEX.filter((x) => x.n.name.toLowerCase().includes(q) || (x.n.nickname ?? "").toLowerCase().includes(q)).slice(0, 9);
        searchRes.innerHTML = m.length
          ? m
              .map(
                (x) =>
                  `<div class="mt-item" data-ti="${x.ti}" data-id="${escapeHtml(String(x.n.id))}">${escapeHtml(x.n.name)}<small>${escapeHtml(x.n.team ?? "")} · ${copy.resultLineage} ${escapeHtml(forest[x.ti].name)}</small></div>`
              )
              .join("")
          : `<div class="mt-item">${copy.noResults}</div>`;
        searchRes.classList.add("mt-show");
        searchRes.querySelectorAll<HTMLDivElement>(".mt-item[data-id]").forEach((it) => {
          it.addEventListener("click", () => {
            const ti = Number(it.dataset.ti);
            const id = it.dataset.id!;
            searchRes.classList.remove("mt-show");
            searchIn.value = "";
            if (Number(treeSel.value) !== ti) {
              treeSel.value = String(ti);
              loadForest(ti);
            }
            let found: TreeNodeM | null = null;
            visitAll(TREE, (x) => {
              if (x.id === id) found = x;
            });
            if (found) {
              const target = found as TreeNodeM;
              let c = target.parent;
              while (c) {
                if (c._children) {
                  c.children = c._children;
                  c._children = null;
                }
                c = c.parent;
              }
              layoutDirty = true;
              layout();
              seedPulses();
              select(target);
              focusNode(target);
            }
          });
        });
      };
      const onSearchKeyDown = (event: KeyboardEvent) => {
        const items = Array.from(searchRes.querySelectorAll<HTMLElement>(".mt-item[data-id]"));
        if (event.key === "Escape") {
          searchRes.classList.remove("mt-show");
          searchIn.blur();
          return;
        }
        if (!items.length) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          activeSearchIndex = Math.min(items.length - 1, activeSearchIndex + 1);
          refreshActiveSearchItem();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          activeSearchIndex = Math.max(0, activeSearchIndex - 1);
          refreshActiveSearchItem();
        } else if (event.key === "Enter") {
          event.preventDefault();
          items[Math.max(activeSearchIndex, 0)]?.click();
        }
      };
      searchIn.addEventListener("input", onSearchInput);
      searchIn.addEventListener("keydown", onSearchKeyDown);
      const onDocClick = (e: MouseEvent) => {
        if (!(e.target as Element).closest(".mt-search-wrap")) searchRes.classList.remove("mt-show");
      };
      document.addEventListener("click", onDocClick);
      cleanups.push(() => {
        searchIn.removeEventListener("input", onSearchInput);
        searchIn.removeEventListener("keydown", onSearchKeyDown);
        document.removeEventListener("click", onDocClick);
      });

      /* ============ init ============ */
      resize();
      const urlParams = new URL(window.location.href).searchParams;
      const requestedPerson = urlParams.get("person");
      const requestedSearch = urlParams.get("search")?.trim() ?? "";
      const requestedDetail = urlParams.get("detail") === "1";
      const requestedTree = Number(urlParams.get("tree") ?? "0");
      const searchSlug = slugify(requestedSearch);
      const deepLink = requestedPerson
        ? INDEX.find((entry) => String(entry.n.id) === requestedPerson)
        : searchSlug
          ? INDEX.find((entry) => slugify(entry.n.name) === searchSlug)
            ?? INDEX.find((entry) => slugify(entry.n.name).includes(searchSlug))
          : undefined;
      const initialTree = deepLink?.ti ?? (Number.isInteger(requestedTree) && forest[requestedTree] ? requestedTree : 0);
      treeSel.value = String(initialTree);
      loadForest(initialTree);
      if (deepLink) {
        const target = findNodeById(TREE, String(deepLink.n.id));
        if (target) {
          let ancestor = target.parent;
          while (ancestor) {
            if (ancestor._children) {
              ancestor.children = ancestor._children;
              ancestor._children = null;
            }
            ancestor = ancestor.parent;
          }
          layoutDirty = true;
          layout();
          select(target, { noCam: true, showDetail: requestedDetail });
          focusNode(target);
        }
      } else if (requestedSearch) {
        searchIn.value = requestedSearch;
        onSearchInput();
      }
      raf = requestAnimationFrame(frame);
      const hintTimer = window.setTimeout(() => {
        if (hintRef.current) hintRef.current.style.opacity = "0";
      }, 9000);
      cleanups.push(() => window.clearTimeout(hintTimer));
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, [copy, locale, numberLocale]);

  return (
    <div ref={rootRef} className="mt-root">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
      />

      <canvas ref={canvasRef} className="mt-canvas" />

      <div className="mt-topbar">
        <a className="mt-brand" href="/">
          <span className="mt-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="The Big Tree BJJ" />
          </span>
          <span className="mt-brand-text">
            <b>THE BIG TREE BJJ</b>
            <small>The Global Jiu-Jitsu Lineage Database</small>
          </span>
        </a>

        <nav className="mt-nav">
          <a href="/">Home</a>
          <a href="/explore" className="mt-nav-active">
            Explore
          </a>
        </nav>

        <div className="mt-tools">
          <select ref={treeSelRef} className="mt-tree-select" aria-label={copy.chooseLineage} />
          <div className="mt-search-wrap">
            <span className="mt-search-icon" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              className="mt-search"
              type="search"
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchAria}
              autoComplete="off"
            />
            <kbd>/</kbd>
            <div ref={searchResRef} className="mt-search-results" />
          </div>
        </div>
      </div>

      <div ref={detailRef} className="mt-detail">
        <div className="mt-detail-handle" aria-hidden="true">
          <span />
        </div>
        <button ref={detailCloseRef} type="button" className="mt-detail-close" aria-label={copy.close}>
          ×
        </button>
        <div ref={detailBodyRef} />
      </div>

      <div ref={tipRef} className="mt-tip" />

      <aside className="mt-sidebar">
        <div className="mt-panel">
          <div className="mt-panel-head">
            <span>{copy.overview}</span>
          </div>
          <div className="mt-minimap">
            <canvas ref={minimapRef} />
          </div>
        </div>

        <div className="mt-panel mt-legend">
          <div className="mt-panel-head">
            <span>{copy.legend}</span>
          </div>
          <div className="mt-row">
            <span className="mt-lg mt-high" /> {copy.bioExtracted}
          </div>
          <div className="mt-row">
            <span className="mt-lg mt-medium" /> {copy.partialName}
          </div>
          <div className="mt-row">
            <span className="mt-lg mt-manual" /> {copy.historicalCuration}
          </div>
        </div>
      </aside>

      <div ref={hintRef} className="mt-hint">
        <span className="mt-hint-desktop">{copy.desktopHint}</span>
        <span className="mt-hint-mobile">{copy.mobileHint}</span>
      </div>

      <div className="mt-bottombar">
        <div className="mt-navgroup" aria-label={copy.treeNavigation}>
          <button ref={parentRef} type="button" className="mt-nav-action" disabled title={copy.backToTeacher}>
            <span aria-hidden="true">↑</span>
            <span>{copy.back}</span>
          </button>
          <button ref={rootButtonRef} type="button" className="mt-nav-action" title={copy.goToRoot}>
            <span aria-hidden="true">⌂</span>
            <span>{copy.root}</span>
          </button>
          <button ref={fitRef} type="button" className="mt-nav-action" title={copy.fitSelection}>
            <span aria-hidden="true">⛶</span>
            <span>{copy.fit}</span>
          </button>
        </div>

        <div className="mt-location" aria-live="polite">
          <span ref={selectedInitialsRef} className="mt-location-avatar" aria-hidden="true">TB</span>
          <span className="mt-location-copy">
            <span ref={selectedLabelRef} className="mt-location-name">{copy.root}</span>
            <small ref={selectedMetaRef}>{copy.treeNavigation}</small>
          </span>
          <a ref={joinSelectionRef} className="mt-location-join" href="/join">
            <span aria-hidden="true">＋</span> {copy.enter}
          </a>
          <button ref={detailOpenRef} type="button" className="mt-location-detail">
            {copy.details} <span aria-hidden="true">↑</span>
          </button>
        </div>

        <div className="mt-zoomgroup" aria-label={copy.zoomControls}>
          <button ref={zoomHelpRef} type="button" className="mt-zoom-help" aria-label={copy.help}>
            ?
          </button>
          <button ref={zoomOutRef} type="button" aria-label={copy.zoomOut}>
            −
          </button>
          <span ref={zoomPctRef} className="mt-zoom-pct">
            85%
          </span>
          <button ref={zoomInRef} type="button" aria-label={copy.zoomIn}>
            +
          </button>
        </div>

        <div className="mt-crumbbar">
          <small>{copy.lineagePath}</small>
          <div ref={crumbRef} className="mt-crumb-list" />
        </div>

        <button ref={shareRef} type="button" className="mt-share">
          <span aria-hidden="true">↗</span>
          <span>{copy.share}</span>
        </button>
      </div>

      <div className="mt-bar mt-bar-top" />
      <div className="mt-bar mt-bar-bot" />
      <div className="mt-caption">
        <small>{copy.lineage}</small>
        <b ref={capNameRef} />
        <span ref={capSubRef} />
      </div>
      <button ref={storyExitRef} type="button" className="mt-story-exit">
        ← {copy.exitStory}
      </button>

      {status === "loading" ? <div className="mt-loading">{copy.loading}</div> : null}
      {status === "error" ? (
        <div className="mt-loading mt-load-error">
          <strong>{copy.loadFailed}</strong>
          <span>{errorMessage}</span>
          <button type="button" onClick={() => window.location.reload()}>
            {copy.retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}

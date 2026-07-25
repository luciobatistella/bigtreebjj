"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import type { ApiLink, TreeNode } from "../page";
import { buildLineageLayout, type LineageLayout } from "../tree/lineageTreeLayout";

/**
 * Porte do motion-proto para o app: canvas 2D com brasas, pulsos de energia,
 * trace de linhagem sequencial e modo história cinematográfico.
 *
 * Contratos idênticos ao LineageCanvas: onSelectNode dispara a expansão via
 * API no page.tsx; onPositions alimenta o minimap (0–100). Story mode via ref:
 *   const tree = useRef<MotionTreeHandle>(null);
 *   tree.current?.playStory(selected.id);
 */

export type MotionTreeHandle = {
  playStory: (nodeId: string) => void;
  stopStory: () => void;
};

const NODE_R = 21;
const LEVEL_GAP = 172; // deve casar com LEVEL_H do layout

const STATUS_STROKE: Record<string, string> = {
  verified: "rgba(95,156,118,",
  pending: "rgba(201,143,76,",
  historical: "rgba(138,128,112,"
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function makeGlowSprite(radius: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = radius * 2;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

function cubicY(ay: number, by: number, t: number) {
  const my = (ay + by) / 2;
  const u = 1 - t;
  return u * u * u * ay + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * by;
}
function cubicX(ax: number, bx: number, t: number) {
  const u = 1 - t;
  return u * u * u * ax + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * bx;
}

type Pulse = { fromId: string; toId: string; t: number; speed: number; status: string };
type Ember = { x: number; y: number; s: number; vy: number; ph: number; drift: number };
type Smooth = { sx: number; sy: number; birth: number };

const MotionTree = forwardRef<MotionTreeHandle, {
  nodes: TreeNode[];
  links: ApiLink[];
  rootId: string;
  selectedId: string;
  onSelectNode: (node: TreeNode) => void;
  onPositions?: (positions: Record<string, { x: number; y: number }>) => void;
}>(function MotionTree({ nodes, links, rootId, selectedId, onSelectNode, onPositions }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  /* ---------- layout (recalcula quando o grafo muda) ---------- */
  const layout = useMemo(() => buildLineageLayout(nodes, links, rootId), [nodes, links, rootId]);
  const layoutRef = useRef<LineageLayout>(layout);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const nodeByIdRef = useRef(nodeById);

  /* ---------- estado mutável fora do React (loop de render) ---------- */
  const camRef = useRef({ x: 0, y: 140, k: 0.85, tx: 0, ty: 140, tk: 0.85 });
  const smoothRef = useRef(new Map<string, Smooth>());
  const pulsesRef = useRef<Pulse[]>([]);
  const embersRef = useRef<Ember[]>([]);
  const pathRef = useRef<{ set: Set<string>; chain: string[]; t0: number }>({
    set: new Set(),
    chain: [],
    t0: 0
  });
  const spritesRef = useRef<{ gold: HTMLCanvasElement; ember: HTMLCanvasElement; halo: HTMLCanvasElement } | null>(null);
  const dragRef = useRef({ active: false, moved: false, lx: 0, ly: 0 });
  const sizeRef = useRef({ w: 800, h: 600, dpr: 1 });
  const fontsRef = useRef(false);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;

  /* ---------- modo história ---------- */
  const [cinema, setCinema] = useState<{ on: boolean; name: string; sub: string }>({
    on: false,
    name: "",
    sub: ""
  });
  const cinemaRef = useRef<{ on: boolean; steps: string[]; idx: number; timer: number }>({
    on: false,
    steps: [],
    idx: 0,
    timer: 0
  });

  /* ---------- helpers de mundo/tela (usam refs) ---------- */
  const worldToScreen = (x: number, y: number): [number, number] => {
    const { w, h } = sizeRef.current;
    const c = camRef.current;
    return [(x - c.x) * c.k + w / 2, (y - c.y) * c.k + h / 2];
  };
  const screenToWorld = (px: number, py: number): [number, number] => {
    const { w, h } = sizeRef.current;
    const c = camRef.current;
    return [(px - w / 2) / c.k + c.x, (py - h / 2) / c.k + c.y];
  };
  const flyTo = (x: number, y: number, k?: number) => {
    camRef.current.tx = x;
    camRef.current.ty = y;
    if (k !== undefined) camRef.current.tk = k;
  };

  const ancestorsChain = (id: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined = id;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      chain.unshift(cursor);
      cursor = layoutRef.current.placed.get(cursor)?.parentId;
    }
    return chain;
  };

  const igniteTrace = (id: string) => {
    const chain = ancestorsChain(id);
    pathRef.current = { chain, set: new Set(chain), t0: performance.now() };
  };

  /* ---------- sincroniza layout/props com o loop ---------- */
  useEffect(() => {
    const previous = layoutRef.current;
    layoutRef.current = layout;
    nodeByIdRef.current = nodeById;

    // nascimento: nós novos surgem da posição do pai com pop
    const now = performance.now();
    let bornIndex = 0;
    layout.placed.forEach((placedNode, id) => {
      if (!smoothRef.current.has(id)) {
        const parent = placedNode.parentId
          ? smoothRef.current.get(placedNode.parentId)
          : undefined;
        smoothRef.current.set(id, {
          sx: parent ? parent.sx : placedNode.x,
          sy: parent ? parent.sy : placedNode.y,
          birth: previous.placed.size ? now + bornIndex * 70 : 0
        });
        bornIndex += 1;
      }
    });
    // limpa órfãos
    Array.from(smoothRef.current.keys()).forEach((id) => {
      if (!layout.placed.has(id)) smoothRef.current.delete(id);
    });

    // pulsos: um por aresta
    pulsesRef.current = layout.edges.map((edge) => ({
      fromId: edge.fromId,
      toId: edge.toId,
      t: Math.random(),
      speed: 0.0022 + Math.random() * 0.002,
      status: edge.link.status
    }));

    // trace acompanha o grafo novo
    if (pathRef.current.chain.length) igniteTrace(selectedRef.current);

    // minimap
    if (onPositions && layout.placed.size) {
      const { minX, maxX, minY, maxY } = layout.bbox;
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const out: Record<string, { x: number; y: number }> = {};
      layout.placed.forEach((entry, id) => {
        out[id] = { x: ((entry.x - minX) / spanX) * 100, y: ((entry.y - minY) / spanY) * 100 };
      });
      onPositions(out);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, nodeById]);

  /* ---------- seleção: trace + câmera ---------- */
  useEffect(() => {
    selectedRef.current = selectedId;
    const placedNode = layoutRef.current.placed.get(selectedId);
    if (!placedNode) return;
    igniteTrace(selectedId);
    if (!cinemaRef.current.on) {
      flyTo(placedNode.x, placedNode.y - LEVEL_GAP * 0.35, Math.max(camRef.current.tk, 0.8));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ---------- modo história (imperativo) ---------- */
  const stopStory = () => {
    const c = cinemaRef.current;
    c.on = false;
    window.clearTimeout(c.timer);
    setCinema({ on: false, name: "", sub: "" });
  };
  const storyStep = () => {
    const c = cinemaRef.current;
    if (!c.on) return;
    const id = c.steps[c.idx];
    const placedNode = layoutRef.current.placed.get(id);
    const node = nodeByIdRef.current.get(id);
    if (!placedNode || !node) {
      stopStory();
      return;
    }
    igniteTrace(id);
    flyTo(placedNode.x, placedNode.y, 1.05);
    setCinema({
      on: true,
      name: node.name,
      sub: `${node.subtitle ? `${node.subtitle}  ·  ` : ""}geração ${c.idx + 1} de ${c.steps.length}`
    });
    c.idx += 1;
    c.timer = window.setTimeout(c.idx < c.steps.length ? storyStep : stopStory, c.idx < c.steps.length ? 1900 : 2600);
  };
  useImperativeHandle(ref, () => ({
    playStory: (nodeId: string) => {
      const chain = ancestorsChain(nodeId);
      if (chain.length < 2) return;
      cinemaRef.current = { on: true, steps: chain, idx: 0, timer: 0 };
      storyStep();
    },
    stopStory
  }));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cinemaRef.current.on) stopStory();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- input: drag / wheel / click / hover ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nodeAt = (px: number, py: number): TreeNode | null => {
      const [wx, wy] = screenToWorld(px, py);
      let best: TreeNode | null = null;
      let bd = (NODE_R + 16) * (NODE_R + 16);
      layoutRef.current.placed.forEach((placedNode, id) => {
        const s = smoothRef.current.get(id);
        if (!s) return;
        const dx = s.sx - wx;
        const dy = s.sy - wy;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = nodeByIdRef.current.get(id) ?? null;
        }
      });
      return best;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current = { active: true, moved: false, lx: event.clientX, ly: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.active) {
        const dx = event.clientX - drag.lx;
        const dy = event.clientY - drag.ly;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        const c = camRef.current;
        c.x -= dx / c.k;
        c.y -= dy / c.k;
        c.tx = c.x;
        c.ty = c.y;
        drag.lx = event.clientX;
        drag.ly = event.clientY;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const hovered = nodeAt(event.clientX - rect.left, event.clientY - rect.top);
      const tip = tipRef.current;
      if (tip) {
        if (hovered && hovered.id !== selectedRef.current) {
          tip.innerHTML = `<b>${hovered.name}</b><span>${hovered.subtitle || "—"}</span>`;
          tip.style.left = `${event.clientX - rect.left + 16}px`;
          tip.style.top = `${event.clientY - rect.top + 10}px`;
          tip.classList.add("show");
          canvas.style.cursor = "pointer";
        } else {
          tip.classList.remove("show");
          canvas.style.cursor = "grab";
        }
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      dragRef.current.active = false;
      canvas.releasePointerCapture(event.pointerId);
    };
    const onClick = (event: MouseEvent) => {
      if (dragRef.current.moved) return;
      const rect = canvas.getBoundingClientRect();
      const hit = nodeAt(event.clientX - rect.left, event.clientY - rect.top);
      if (hit) onSelectRef.current(hit);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      const c = camRef.current;
      const [wx, wy] = screenToWorld(px, py);
      const nk = Math.min(2.4, Math.max(0.16, c.tk * factor));
      const { w, h } = sizeRef.current;
      c.tx = wx - (px - w / 2) / nk;
      c.ty = wy - (py - h / 2) / nk;
      c.tk = nk;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- loop de render ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;

    spritesRef.current = {
      gold: makeGlowSprite(32, "rgba(232,192,120,0.9)"),
      ember: makeGlowSprite(16, "rgba(224,150,70,0.8)"),
      halo: makeGlowSprite(90, "rgba(201,151,76,0.55)")
    };
    embersRef.current = Array.from({ length: 54 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.5 + Math.random() * 1.4,
      vy: 0.006 + Math.random() * 0.02,
      ph: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.008
    }));
    document.fonts?.ready.then(() => {
      fontsRef.current = true;
    });

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const { w, h, dpr } = sizeRef.current;
      const cam = camRef.current;
      const sprites = spritesRef.current!;
      const currentLayout = layoutRef.current;
      const path = pathRef.current;
      const dimmed = path.chain.length > 1;
      const t = now * 0.001;

      cam.x += (cam.tx - cam.x) * 0.085;
      cam.y += (cam.ty - cam.y) * 0.085;
      cam.k += (cam.tk - cam.k) * 0.085;

      currentLayout.placed.forEach((placedNode, id) => {
        const s = smoothRef.current.get(id);
        if (!s) return;
        s.sx += (placedNode.x - s.sx) * 0.12;
        s.sy += (placedNode.y - s.sy) * 0.12;
      });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0805";
      ctx.fillRect(0, 0, w, h);

      /* brasas */
      if (!reduced) {
        ctx.globalCompositeOperation = "lighter";
        embersRef.current.forEach((p) => {
          p.y -= p.vy / 60;
          p.x += p.drift / 60;
          p.ph += 0.02;
          if (p.y < -0.02) {
            p.y = 1.02;
            p.x = Math.random();
          }
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(p.ph);
          const s = p.s * 8;
          ctx.drawImage(sprites.ember, p.x * w - s / 2, p.y * h - s / 2, s, s);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      const reveal = (id: string) => {
        const idx = path.chain.indexOf(id);
        if (idx <= 0) return idx === 0 ? 1 : 0;
        return Math.max(0, Math.min(1, (now - path.t0 - (idx - 1) * 230) / 420));
      };

      /* arestas */
      currentLayout.edges.forEach((edge) => {
        const from = smoothRef.current.get(edge.fromId);
        const to = smoothRef.current.get(edge.toId);
        if (!from || !to) return;
        const [ax, ay] = worldToScreen(from.sx, from.sy + NODE_R);
        const [bx, by] = worldToScreen(to.sx, to.sy - NODE_R);
        const lit = path.set.has(edge.fromId) && path.set.has(edge.toId);
        const rv = lit ? reveal(edge.toId) : 0;
        let alpha = dimmed && !lit ? 0.1 : 0.5;
        if (lit) alpha = 0.25 + rv * 0.75;
        const base = STATUS_STROKE[edge.link.status] ?? "rgba(138,106,52,";
        const my = (ay + by) / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax, my, bx, my, bx, by);
        ctx.strokeStyle = (lit && rv > 0 ? "rgba(232,192,120," : base) + alpha + ")";
        ctx.lineWidth = (lit ? 2.4 : 1.3) * Math.min(cam.k, 1.2);
        if (!lit && edge.link.status !== "verified") ctx.setLineDash([6, 5]);
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

      /* pulsos */
      if (!reduced) {
        ctx.globalCompositeOperation = "lighter";
        pulsesRef.current.forEach((pulse) => {
          const from = smoothRef.current.get(pulse.fromId);
          const to = smoothRef.current.get(pulse.toId);
          if (!from || !to) return;
          const lit = path.set.has(pulse.fromId) && path.set.has(pulse.toId);
          pulse.t += pulse.speed * (lit ? 2.6 : 1);
          if (pulse.t > 1) pulse.t = 0;
          if (dimmed && !lit) return;
          const [ax, ay] = worldToScreen(from.sx, from.sy + NODE_R);
          const [bx, by] = worldToScreen(to.sx, to.sy - NODE_R);
          const px = cubicX(ax, bx, pulse.t);
          const py = cubicY(ay, by, pulse.t);
          const s = (lit ? 22 : 11) * Math.min(cam.k, 1.3);
          ctx.globalAlpha = lit ? 0.9 : 0.45;
          ctx.drawImage(sprites.gold, px - s / 2, py - s / 2, s, s);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      /* nós */
      const serif = fontsRef.current ? "Fraunces, Georgia, serif" : "Georgia, serif";
      currentLayout.placed.forEach((placedNode, id) => {
        const s = smoothRef.current.get(id);
        const node = nodeByIdRef.current.get(id);
        if (!s || !node) return;
        const [sx, sy] = worldToScreen(s.sx, s.sy);
        if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) return;
        const onPath = path.set.has(id);
        const isSel = id === selectedRef.current;
        const born = s.birth ? Math.min(1, (now - s.birth) / 450) : 1;
        if (born <= 0) return;
        const pop = born < 1 ? (1 - Math.pow(1 - born, 3)) * (1 + 0.25 * Math.sin(born * Math.PI)) : 1;
        const r = NODE_R * Math.min(cam.k, 1.35) * pop * (placedNode.depth === 0 || placedNode.isAncestor ? 1.12 : 1);
        let alpha = dimmed && !onPath ? 0.16 : 1;
        alpha *= born;

        if (isSel || (onPath && dimmed)) {
          const rv = isSel ? 1 : reveal(id);
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (isSel ? 0.55 + 0.18 * Math.sin(t * 3) : 0.3) * rv;
          const hs = r * 4.6;
          ctx.drawImage(sprites.halo, sx - hs / 2, sy - hs / 2, hs, hs);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.35, r * 0.2, sx, sy, r);
        grad.addColorStop(0, "#2c2312");
        grad.addColorStop(1, "#120e08");
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = isSel ? 2.6 : 1.6;
        ctx.strokeStyle = isSel ? "#e8c078" : placedNode.isAncestor ? "rgba(123,158,201,0.8)" : "#8a6a34";
        ctx.stroke();

        if (cam.k > 0.3) {
          ctx.fillStyle = onPath || !dimmed ? "#e8c078" : "rgba(232,192,120,0.5)";
          ctx.font = `600 ${Math.max(9, r * 0.62)}px ${serif}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials(node.name), sx, sy + 1);
        }
        if (cam.k > 0.42) {
          ctx.fillStyle = dimmed && !onPath ? "rgba(241,231,211,0.25)" : "#f1e7d3";
          ctx.font = `500 ${11.5 * Math.min(cam.k, 1.15)}px ${serif}`;
          ctx.fillText(node.name, sx, sy + r + 14 * Math.min(cam.k, 1.2));
          if (cam.k > 0.75 && node.subtitle) {
            ctx.fillStyle = dimmed && !onPath ? "rgba(107,98,85,0.35)" : "#6b6255";
            ctx.font = `400 ${9.5 * Math.min(cam.k, 1.1)}px Inter, sans-serif`;
            const team = node.subtitle.length > 26 ? `${node.subtitle.slice(0, 25)}…` : node.subtitle;
            ctx.fillText(team, sx, sy + r + 28 * Math.min(cam.k, 1.2));
          }
        }
        /* badge de expandir (API) */
        if (node.expandable && !node.loaded && cam.k > 0.3) {
          const by2 = sy + r + (cam.k > 0.42 ? (cam.k > 0.75 && node.subtitle ? 40 : 26) * Math.min(cam.k, 1.2) : 16);
          ctx.beginPath();
          ctx.arc(sx, by2, 10, 0, Math.PI * 2);
          ctx.fillStyle = "#1d180f";
          ctx.fill();
          ctx.strokeStyle = "#8a6a34";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#e8c078";
          ctx.font = "600 10px Inter, sans-serif";
          ctx.fillText("+", sx, by2 + 0.5);
        }
        ctx.globalAlpha = 1;
      });

      /* vinheta */
      const vg = ctx.createRadialGradient(w / 2, h * 0.38, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className={`mtree-wrap${cinema.on ? " mtree-cinema" : ""}`}>
      <canvas ref={canvasRef} className="mtree-canvas" />
      <div ref={tipRef} className="mtree-tip" />
      <div className="mtree-bar mtree-bar--top" />
      <div className="mtree-bar mtree-bar--bottom" />
      <div className="mtree-caption">
        <small>Linhagem</small>
        <b>{cinema.name}</b>
        <span>{cinema.sub}</span>
      </div>
      {cinema.on ? (
        <button type="button" className="mtree-exit" onClick={stopStory}>
          ✕ sair do modo história
        </button>
      ) : null}
    </div>
  );
});

export default MotionTree;

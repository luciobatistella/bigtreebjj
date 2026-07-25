"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiLink, TreeNode } from "../page";
import {
  CARD_H,
  CARD_W,
  buildLineageLayout,
  edgePath,
  type PlacedNode
} from "./lineageTreeLayout";

/**
 * Árvore de linhagem em SVG — layout tidy vertical, texto nítido, motion via
 * CSS. Substitui o LineageCanvas mantendo os mesmos contratos do page.tsx:
 * onSelectNode, onPositions (minimap), pathIds/traceT0 (useLineageTrace).
 *
 * Estilos em lineage-tree.css (prefixo .ltree-).
 */

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function splitName(name: string): [string, string?] {
  if (name.length <= 18) return [name];
  const words = name.split(" ");
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

type Camera = { x: number; y: number; k: number };

export default function LineageTree({
  nodes,
  links,
  rootId,
  selectedId,
  pathIds = [],
  traceT0 = 0,
  onSelectNode,
  onPositions
}: {
  nodes: TreeNode[];
  links: ApiLink[];
  rootId: string;
  selectedId: string;
  pathIds?: string[];
  traceT0?: number;
  onSelectNode: (node: TreeNode) => void;
  onPositions?: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState<Camera>({ x: 0, y: 140, k: 0.9 });
  const camRef = useRef(cam);
  camRef.current = cam;

  const layout = useMemo(() => buildLineageLayout(nodes, links, rootId), [nodes, links, rootId]);
  const pathSet = useMemo(() => new Set(pathIds), [pathIds]);
  const pathIndexById = useMemo(
    () => new Map(pathIds.map((id, index) => [id, index])),
    [pathIds]
  );
  const tracing = pathIds.length > 1 && traceT0 > 0;

  /* ---------- medir container ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ---------- minimap: reporta posições em 0..100 ---------- */
  useEffect(() => {
    if (!onPositions || !layout.placed.size) return;
    const { minX, maxX, minY, maxY } = layout.bbox;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const out: Record<string, { x: number; y: number }> = {};
    layout.placed.forEach((entry, id) => {
      out[id] = {
        x: ((entry.x - minX) / spanX) * 100,
        y: ((entry.y - minY) / spanY) * 100
      };
    });
    onPositions(out);
  }, [layout, onPositions]);

  /* ---------- fly-to no selecionado ---------- */
  const flyTo = useCallback((tx: number, ty: number, tk?: number) => {
    const start = { ...camRef.current };
    const target = { x: tx, y: ty, k: tk ?? start.k };
    const t0 = performance.now();
    const DURATION = 520;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / DURATION);
      const e = 1 - Math.pow(1 - t, 3);
      setCam({
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        k: start.k + (target.k - start.k) * e
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const target = layout.placed.get(selectedId);
    if (!target) return;
    return flyTo(target.x, target.y, Math.max(camRef.current.k, 0.75));
  }, [selectedId, layout, flyTo]);

  /* ---------- pan / zoom ---------- */
  const drag = useRef({ active: false, moved: false, lastX: 0, lastY: 0 });
  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { active: true, moved: false, lastX: event.clientX, lastY: event.clientY };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.lastX;
    const dy = event.clientY - drag.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.lastX = event.clientX;
    drag.current.lastY = event.clientY;
    setCam((current) => ({ ...current, x: current.x - dx / current.k, y: current.y - dy / current.k }));
  };
  const onPointerUp = () => {
    drag.current.active = false;
  };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      setCam((current) => {
        const k = Math.min(2.4, Math.max(0.18, current.k * factor));
        const rect = el.getBoundingClientRect();
        const px = event.clientX - rect.left - rect.width / 2;
        const py = event.clientY - rect.top - rect.height / 2;
        // zoom em direção ao cursor
        const wx = px / current.k + current.x;
        const wy = py / current.k + current.y;
        return { k, x: wx - px / k, y: wy - py / k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleNodeClick = (node: TreeNode) => {
    if (drag.current.moved) return;
    onSelectNode(node);
  };

  const transform = `translate(${size.w / 2 - cam.x * cam.k}, ${size.h / 2 - cam.y * cam.k}) scale(${cam.k})`;
  const showTeam = cam.k > 0.62;

  const placedList = useMemo(() => Array.from(layout.placed.values()), [layout]);

  return (
    <div
      ref={wrapRef}
      className={`ltree-wrap${tracing ? " ltree-tracing" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg className="ltree-svg" width={size.w} height={size.h} role="img" aria-label="Árvore de linhagem">
        <g transform={transform}>
          {/* ---------- arestas ---------- */}
          {layout.edges.map((edge) => {
            const from = layout.placed.get(edge.fromId);
            const to = layout.placed.get(edge.toId);
            if (!from || !to) return null;
            const onPath = pathSet.has(edge.fromId) && pathSet.has(edge.toId);
            const pathIndex = onPath
              ? Math.max(pathIndexById.get(edge.fromId) ?? 0, pathIndexById.get(edge.toId) ?? 0)
              : 0;
            const classes = [
              "ltree-edge",
              `ltree-edge--${edge.link.status}`,
              onPath ? "ltree-edge--on-path" : "",
              tracing && !onPath ? "ltree-edge--dim" : ""
            ].filter(Boolean).join(" ");
            return (
              <path
                key={`${edge.id}:${edge.fromId}->${edge.toId}`}
                className={classes}
                d={edgePath(from.x, from.y, to.x, to.y)}
                style={onPath ? ({ "--trace-i": pathIndex } as React.CSSProperties) : undefined}
              />
            );
          })}

          {/* ---------- cards ---------- */}
          {placedList.map((entry: PlacedNode) => {
            const { node } = entry;
            const onPath = pathSet.has(node.id);
            const isSelected = node.id === selectedId;
            const pathIndex = pathIndexById.get(node.id) ?? 0;
            const [line1, line2] = splitName(node.name);
            const classes = [
              "ltree-card",
              `ltree-card--${node.status}`,
              isSelected ? "ltree-card--selected" : "",
              onPath ? "ltree-card--on-path" : "",
              tracing && !onPath ? "ltree-card--dim" : "",
              entry.isAncestor ? "ltree-card--ancestor" : ""
            ].filter(Boolean).join(" ");
            const photo = (node as TreeNode & { photo?: string }).photo;
            return (
              <g
                key={node.id}
                className={classes}
                transform={`translate(${entry.x}, ${entry.y})`}
                style={onPath ? ({ "--trace-i": pathIndex } as React.CSSProperties) : undefined}
                onClick={() => handleNodeClick(node)}
              >
                <rect
                  className="ltree-card-bg"
                  x={-CARD_W / 2}
                  y={-CARD_H / 2}
                  width={CARD_W}
                  height={CARD_H}
                  rx={12}
                />
                <circle className="ltree-avatar-ring" cx={0} cy={-CARD_H / 2 + 30} r={22} />
                {photo ? (
                  <>
                    <clipPath id={`ltree-clip-${node.id}`}>
                      <circle cx={0} cy={-CARD_H / 2 + 30} r={20.5} />
                    </clipPath>
                    <image
                      href={photo}
                      x={-20.5}
                      y={-CARD_H / 2 + 9.5}
                      width={41}
                      height={41}
                      preserveAspectRatio="xMidYMin slice"
                      clipPath={`url(#ltree-clip-${node.id})`}
                    />
                  </>
                ) : (
                  <text className="ltree-initials" x={0} y={-CARD_H / 2 + 31}>
                    {initials(node.name)}
                  </text>
                )}
                <text className="ltree-name" x={0} y={line2 ? 8 : 14}>
                  {line1}
                </text>
                {line2 ? (
                  <text className="ltree-name" x={0} y={22}>
                    {line2}
                  </text>
                ) : null}
                {showTeam && node.subtitle ? (
                  <text className="ltree-team" x={0} y={line2 ? 37 : 32}>
                    {node.subtitle.length > 24 ? `${node.subtitle.slice(0, 23)}…` : node.subtitle}
                  </text>
                ) : null}
                {node.expandable && !node.loaded ? (
                  <g className="ltree-expand" transform={`translate(0, ${CARD_H / 2 + 2})`}>
                    <circle r={10} />
                    <text y={0.5}>+</text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

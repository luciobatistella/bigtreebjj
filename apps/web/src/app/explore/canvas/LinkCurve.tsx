"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import * as THREE from "three";
import type { SimNode } from "./useForceLayout";
import type { ApiLink } from "../page";
import { STATUS_COLOR, toWorld } from "./space";
import { GOLD_HOT, linkMid, traceReveal } from "./fx/gold";

type LineHandle = {
  geometry: { setPositions: (positions: Float32Array) => void };
  material: { dashOffset: number; opacity: number; color: THREE.Color; linewidth?: number };
};

const HOT = new THREE.Color(GOLD_HOT);

export function LinkCurve({
  link,
  simRef,
  active,
  onPath = false,
  pathIndex = 0,
  traceT0 = 0,
  dimmed = false
}: {
  link: ApiLink;
  simRef: React.MutableRefObject<Map<string, SimNode>>;
  active: boolean;
  /** este elo pertence ao caminho de linhagem aceso */
  onPath?: boolean;
  /** posição do elo na cadeia (0 = raiz→primeiro) — controla o stagger do trace */
  pathIndex?: number;
  /** performance.now() do início do trace (vem do useLineageTrace) */
  traceT0?: number;
  /** existe um caminho aceso e este elo está fora dele */
  dimmed?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null);
  const baseColor = useRef(new THREE.Color(STATUS_COLOR[link.status]));

  useFrame((_state, delta) => {
    const from = simRef.current.get(link.from);
    const to = simRef.current.get(link.to);
    const line = lineRef.current as LineHandle | null;
    if (!from || !to || !line) return;

    const [fx, fy] = toWorld(from.x, from.y);
    const [tx, ty] = toWorld(to.x, to.y);
    const [mx, my] = linkMid(fx, fy, tx, ty);
    line.geometry.setPositions(new Float32Array([fx, fy, 0, mx, my, 0, tx, ty, 0]));

    const reveal = onPath ? traceReveal(traceT0, pathIndex) : 0;

    if (typeof line.material.dashOffset === "number") {
      const flow = onPath ? 2.6 : link.status === "pending" ? 1.4 : 0.7;
      line.material.dashOffset -= delta * flow;
    }

    if (onPath && reveal > 0) {
      // acende: cor esquenta para o dourado e opacidade sobe com o reveal
      line.material.color.copy(baseColor.current).lerp(HOT, reveal);
      line.material.opacity = 0.3 + reveal * 0.7;
    } else {
      line.material.color.copy(baseColor.current);
      line.material.opacity = dimmed ? 0.08 : active ? 0.95 : 0.4;
    }
  });

  return (
    <QuadraticBezierLine
      ref={lineRef}
      start={[0, 0, 0]}
      end={[0, 0.001, 0]}
      mid={[0, 0.0005, 0]}
      color={STATUS_COLOR[link.status]}
      lineWidth={onPath ? 2.8 : active ? 2.4 : 1.3}
      dashed
      dashScale={2.4}
      dashSize={0.6}
      gapSize={0.35}
      transparent
    />
  );
}

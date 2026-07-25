"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { ApiLink, TreeNode } from "../page";
import { useForceLayout } from "./useForceLayout";
import { CameraRig } from "./CameraRig";
import { NodePortrait } from "./NodePortrait";
import { LinkCurve } from "./LinkCurve";
import { RootBackground } from "./RootBackground";
import { Embers } from "./fx/Embers";
import { LinkPulses } from "./fx/LinkPulses";
import { useReducedMotion, isWebglAvailable } from "./useReducedMotion";

function Scene({
  nodes,
  links,
  rootId,
  selectedId,
  neighborIds,
  viewMode,
  zoom,
  pathIds,
  traceT0,
  onSelectNode,
  onPositions,
  reducedMotion
}: {
  nodes: TreeNode[];
  links: ApiLink[];
  rootId: string;
  selectedId: string;
  neighborIds: string[];
  viewMode: "tree" | "focus" | "compact";
  zoom: number;
  pathIds: string[];
  traceT0: number;
  onSelectNode: (node: TreeNode) => void;
  onPositions?: (positions: Record<string, { x: number; y: number }>) => void;
  reducedMotion: boolean;
}) {
  const simRef = useForceLayout(nodes, links, rootId, onPositions);
  const neighborSet = useMemo(() => new Set(neighborIds), [neighborIds]);
  const pathSet = useMemo(() => new Set(pathIds), [pathIds]);
  const pathIndexById = useMemo(() => new Map(pathIds.map((id, index) => [id, index])), [pathIds]);
  // trace só escurece o resto quando há uma cadeia de verdade (2+ nós)
  const tracing = pathIds.length > 1;

  return (
    <>
      <RootBackground reducedMotion={reducedMotion} />
      <Embers reducedMotion={reducedMotion} />
      {links.map((link) => {
        const onPath = pathSet.has(link.from) && pathSet.has(link.to);
        return (
          <LinkCurve
            key={link.id}
            link={link}
            simRef={simRef}
            active={link.from === selectedId || link.to === selectedId}
            onPath={onPath}
            pathIndex={onPath ? Math.max(pathIndexById.get(link.to) ?? 0, pathIndexById.get(link.from) ?? 0) : 0}
            traceT0={traceT0}
            dimmed={tracing && !onPath}
          />
        );
      })}
      <LinkPulses links={links} simRef={simRef} pathIds={tracing ? pathIds : []} reducedMotion={reducedMotion} />
      {nodes.map((node) => (
        <NodePortrait
          key={node.id}
          node={node}
          simRef={simRef}
          active={node.id === selectedId}
          neighbor={neighborSet.has(node.id)}
          faded={viewMode === "focus" && node.id !== selectedId && !neighborSet.has(node.id)}
          onSelect={onSelectNode}
          onPath={pathSet.has(node.id)}
          pathIndex={pathIndexById.get(node.id) ?? 0}
          traceT0={traceT0}
          dimmed={tracing && !pathSet.has(node.id)}
        />
      ))}
      <CameraRig simRef={simRef} selectedId={selectedId || rootId} externalZoom={zoom} reducedMotion={reducedMotion} />
    </>
  );
}

export default function LineageCanvas(props: {
  nodes: TreeNode[];
  links: ApiLink[];
  rootId: string;
  selectedId: string;
  neighborIds: string[];
  viewMode: "tree" | "focus" | "compact";
  zoom: number;
  pathIds?: string[];
  traceT0?: number;
  onSelectNode: (node: TreeNode) => void;
  onPositions?: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [webglOk] = useState(() => isWebglAvailable());

  if (!webglOk) {
    return (
      <div className="lineage-webgl-fallback">
        <p>Este navegador não tem WebGL disponível. A árvore interativa precisa dele para renderizar.</p>
        <p>Tente atualizar o navegador ou habilitar aceleração de hardware.</p>
      </div>
    );
  }

  return (
    <Canvas
      className="lineage-webgl-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 200 }}
      onPointerMissed={() => undefined}
    >
      <color attach="background" args={["#050607"]} />
      <fog attach="fog" args={["#050607", 40, 90]} />
      <Suspense fallback={null}>
        <Scene {...props} pathIds={props.pathIds ?? []} traceT0={props.traceT0 ?? 0} reducedMotion={reducedMotion} />
      </Suspense>
      {!reducedMotion ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.85} luminanceThreshold={0.35} luminanceSmoothing={0.25} mipmapBlur radius={0.65} />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
      ) : (
        <></>
      )}
    </Canvas>
  );
}

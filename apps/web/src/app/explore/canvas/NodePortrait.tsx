"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { SimNode } from "./useForceLayout";
import type { TreeNode } from "../page";
import { MESH_RADIUS, STATUS_COLOR, toWorld } from "./space";
import { GOLD_HOT, makeGlowSprite, traceReveal } from "./fx/gold";

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

function makePortraitTexture(label: string, ringColor: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "#2c2313");
  gradient.addColorStop(1, "#0e0b07");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.fillStyle = "#f0dfb8";
  ctx.font = "600 88px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function NodePortrait({
  node,
  simRef,
  active,
  neighbor,
  faded,
  onSelect,
  onPath = false,
  pathIndex = 0,
  traceT0 = 0,
  dimmed = false
}: {
  node: TreeNode;
  simRef: React.MutableRefObject<Map<string, SimNode>>;
  active: boolean;
  neighbor: boolean;
  faded: boolean;
  onSelect: (node: TreeNode) => void;
  /** nó pertence ao caminho de linhagem aceso */
  onPath?: boolean;
  /** posição na cadeia (0 = raiz) — stagger da revelação */
  pathIndex?: number;
  /** performance.now() do início do trace */
  traceT0?: number;
  /** há trace ativo e este nó está fora dele */
  dimmed?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.MeshBasicMaterial>(null);
  const textRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const ringColor = STATUS_COLOR[node.status];
  const texture = useMemo(() => makePortraitTexture(initials(node.name), ringColor), [node.name, ringColor]);
  const haloSprite = useMemo(() => makeGlowSprite(96), []);
  const radius = MESH_RADIUS[node.size] * (active ? 1.35 : neighbor ? 1.08 : 1);

  useFrame((state, delta) => {
    const sim = simRef.current.get(node.id);
    if (!sim || !groupRef.current) return;
    const [wx, wy] = toWorld(sim.x, sim.y);
    const dt = delta || 0.016;
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, wx, 6, dt);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, wy, 6, dt);
    groupRef.current.scale.setScalar(THREE.MathUtils.damp(groupRef.current.scale.x, radius, 8, dt));

    const reveal = onPath ? traceReveal(traceT0, Math.max(0, pathIndex)) : 0;
    const dimFactor = dimmed && !onPath ? 0.15 : 1;

    if (materialRef.current) {
      const pulse = active ? 0.85 + Math.sin(state.clock.elapsedTime * 2.4) * 0.15 : 1;
      materialRef.current.opacity = (faded ? 0.28 : 1) * pulse * dimFactor;
    }
    if (haloRef.current) {
      const base = active ? 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.16 : onPath ? 0.32 : 0;
      haloRef.current.opacity = base * (onPath && !active ? reveal : 1);
    }
    if (textRef.current) {
      // drei <Text> expõe fillOpacity no runtime
      textRef.current.fillOpacity = dimFactor * (faded ? 0.4 : 1);
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* halo aditivo — brilha acima do luminanceThreshold e o Bloom floresce */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshBasicMaterial
          ref={haloRef}
          map={haloSprite}
          color={GOLD_HOT}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial ref={materialRef} map={texture} transparent toneMapped={false} />
      </mesh>
      <Text
        ref={textRef}
        position={[0, -1.35, 0]}
        fontSize={0.55}
        color={active || onPath ? "#f0dfb8" : "#c9bfa8"}
        anchorX="center"
        anchorY="top"
        outlineWidth={0.02}
        outlineColor="#050607"
        maxWidth={6}
      >
        {node.name}
      </Text>
      {node.expandable ? (
        <Text position={[0.85, 0.85, 0]} fontSize={0.55} color={ringColor} anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#050607">
          +
        </Text>
      ) : null}
    </group>
  );
}

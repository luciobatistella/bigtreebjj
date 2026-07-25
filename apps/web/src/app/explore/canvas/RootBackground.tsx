"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

// Deterministic PRNG so the generated roots are stable across re-renders/reloads.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRoot(random: () => number, originX: number, spread: number) {
  const points: THREE.Vector3[] = [];
  let x = originX;
  let y = 26;
  let angle = Math.PI / 2 + (random() - 0.5) * 0.4;
  const steps = 10 + Math.floor(random() * 6);
  for (let i = 0; i < steps; i += 1) {
    const length = 3.4 + random() * 2.2;
    angle += (random() - 0.5) * spread;
    x += Math.cos(angle) * length;
    y -= Math.abs(Math.sin(angle)) * length * 0.8 + 1.4;
    points.push(new THREE.Vector3(x, y, -32 - random() * 14));
  }
  return points;
}

export function RootBackground({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const roots = useMemo(() => {
    const random = mulberry32(1337);
    const branches: { points: THREE.Vector3[]; opacity: number }[] = [];
    for (let i = 0; i < 9; i += 1) {
      const originX = -32 + (64 / 8) * i + (random() - 0.5) * 6;
      branches.push({ points: buildRoot(random, originX, 0.9), opacity: 0.12 + random() * 0.16 });
    }
    return branches;
  }, []);

  useFrame((state) => {
    if (!groupRef.current || reducedMotion) return;
    const t = state.clock.elapsedTime;
    groupRef.current.scale.setScalar(1 + Math.sin(t / 4) * 0.015);
    groupRef.current.rotation.z = Math.sin(t / 6) * 0.01;
  });

  return (
    <group ref={groupRef}>
      {roots.map((root, index) => (
        <Line key={index} points={root.points} color="#8a5f24" lineWidth={1.1} transparent opacity={root.opacity} />
      ))}
    </group>
  );
}

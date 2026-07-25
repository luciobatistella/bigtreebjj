"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD_EMBER, makeGlowSprite } from "./gold";

const COUNT = 72;
const BOX = { x: 34, yMin: -28, yMax: 30, z: -6 };

/**
 * Brasas subindo lentamente ao fundo da cena — atmosfera, não informação.
 * Additive + toneMapped:false deixa o Bloom existente dar o brilho.
 */
export function Embers({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const sprite = useMemo(() => makeGlowSprite(48), []);

  const { positions, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = (Math.random() * 2 - 1) * BOX.x;
      positions[i * 3 + 1] = BOX.yMin + Math.random() * (BOX.yMax - BOX.yMin);
      positions[i * 3 + 2] = BOX.z - Math.random() * 10;
      speeds[i] = 0.35 + Math.random() * 0.9;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, []);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points || reducedMotion) return;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i += 1) {
      arr[i * 3 + 1] += speeds[i] * delta;
      arr[i * 3] += Math.sin(t * 0.6 + phases[i]) * delta * 0.25;
      if (arr[i * 3 + 1] > BOX.yMax) {
        arr[i * 3 + 1] = BOX.yMin;
        arr[i * 3] = (Math.random() * 2 - 1) * BOX.x;
      }
    }
    attr.needsUpdate = true;
    const material = points.material as THREE.PointsMaterial;
    material.opacity = 0.34 + Math.sin(t * 1.7) * 0.08;
  });

  if (reducedMotion) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        color={GOLD_EMBER}
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

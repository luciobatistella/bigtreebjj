"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ApiLink } from "../../page";
import type { SimNode } from "../useForceLayout";
import { toWorld } from "../space";
import { GOLD, GOLD_HOT, linkMid, makeGlowSprite, quadPoint } from "./gold";

type Pulse = { from: string; to: string; t: number; speed: number; lit: boolean };

/**
 * Partículas douradas fluindo do mestre para o aluno ao longo de cada link
 * (mesma curva do LinkCurve). No caminho de linhagem aceso ficam maiores,
 * mais rápidas e mais quentes — o Bloom faz o resto.
 *
 * Duas nuvens de THREE.Points (normal / lit) para variar tamanho e cor sem
 * shader custom.
 */
export function LinkPulses({
  links,
  simRef,
  pathIds,
  reducedMotion
}: {
  links: ApiLink[];
  simRef: React.MutableRefObject<Map<string, SimNode>>;
  pathIds: string[];
  reducedMotion: boolean;
}) {
  const normalRef = useRef<THREE.Points>(null);
  const litRef = useRef<THREE.Points>(null);
  const sprite = useMemo(() => makeGlowSprite(64), []);

  const pathKey = pathIds.join("|");
  const pulses = useMemo<Pulse[]>(() => {
    const pathSet = new Set(pathIds);
    const list: Pulse[] = [];
    links.forEach((link) => {
      const lit = pathSet.has(link.from) && pathSet.has(link.to);
      const count = lit ? 3 : 1;
      for (let i = 0; i < count; i += 1) {
        list.push({
          from: link.from,
          to: link.to,
          t: (i / count + Math.random() * 0.4) % 1,
          speed: 0.13 + Math.random() * 0.12,
          lit
        });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, pathKey]);

  const buffers = useMemo(() => {
    const normal = pulses.filter((p) => !p.lit);
    const lit = pulses.filter((p) => p.lit);
    return {
      normal,
      lit,
      normalPos: new Float32Array(Math.max(1, normal.length) * 3),
      litPos: new Float32Array(Math.max(1, lit.length) * 3)
    };
  }, [pulses]);

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    const write = (list: Pulse[], arr: Float32Array, ref: React.RefObject<THREE.Points>) => {
      list.forEach((pulse, i) => {
        pulse.t += pulse.speed * (pulse.lit ? 2.4 : 1) * delta;
        if (pulse.t > 1) pulse.t -= 1;
        const from = simRef.current.get(pulse.from);
        const to = simRef.current.get(pulse.to);
        if (!from || !to) {
          arr[i * 3 + 2] = 999; // esconde fora do frustum lógico
          return;
        }
        const [fx, fy] = toWorld(from.x, from.y);
        const [tx, ty] = toWorld(to.x, to.y);
        const [mx, my] = linkMid(fx, fy, tx, ty);
        const [px, py] = quadPoint(fx, fy, mx, my, tx, ty, pulse.t);
        arr[i * 3] = px;
        arr[i * 3 + 1] = py;
        arr[i * 3 + 2] = 0.05;
      });
      const points = ref.current;
      if (points) {
        (points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      }
    };
    write(buffers.normal, buffers.normalPos, normalRef);
    write(buffers.lit, buffers.litPos, litRef);
  });

  if (reducedMotion) return null;

  return (
    <>
      <points ref={normalRef} frustumCulled={false}>
        <bufferGeometry key={`n${buffers.normal.length}`}>
          <bufferAttribute attach="attributes-position" args={[buffers.normalPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color={GOLD}
          size={0.5}
          sizeAttenuation
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <points ref={litRef} frustumCulled={false}>
        <bufferGeometry key={`l${buffers.lit.length}`}>
          <bufferAttribute attach="attributes-position" args={[buffers.litPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color={GOLD_HOT}
          size={1.35}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </>
  );
}

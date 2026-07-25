"use client";

import * as THREE from "three";

/**
 * Paleta dos efeitos. GOLD_HOT é intencionalmente mais claro que o limiar do
 * Bloom (luminanceThreshold 0.35 no composer) para que pulsos e halos floresçam
 * sem precisar mexer no resto da cena.
 */
export const GOLD = "#c9974c";
export const GOLD_HOT = "#ffd98a";
export const GOLD_EMBER = "#e09646";

/** Sprite radial (branco→transparente) tingido pela cor do material. */
export function makeGlowSprite(size = 64): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Mesmo ponto médio usado pelo LinkCurve, para os pulsos viajarem exatamente
 * sobre a curva desenhada (qualquer divergência fica visível no bloom).
 */
export function linkMid(fx: number, fy: number, tx: number, ty: number): [number, number] {
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2 + (Math.abs(fx - tx) > Math.abs(fy - ty) ? 0 : 1.2);
  return [mx, my];
}

/** Ponto sobre bézier quadrática. */
export function quadPoint(
  fx: number, fy: number,
  mx: number, my: number,
  tx: number, ty: number,
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * fx + 2 * u * t * mx + t * t * tx,
    u * u * fy + 2 * u * t * my + t * t * ty
  ];
}

/** Progresso 0..1 do trace para o elo `pathIndex`, dado o t0 em ms (performance.now). */
export function traceReveal(traceT0: number, pathIndex: number): number {
  if (!traceT0) return 0;
  const t = (performance.now() - traceT0 - pathIndex * 230) / 420;
  return Math.max(0, Math.min(1, t));
}

"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { SimNode } from "./useForceLayout";
import { toWorld } from "./space";

const BASE_DISTANCE = 34;
const TILT = 6;

export function CameraRig({
  simRef,
  selectedId,
  externalZoom,
  reducedMotion
}: {
  simRef: React.MutableRefObject<Map<string, SimNode>>;
  selectedId: string;
  externalZoom: number;
  reducedMotion: boolean;
}) {
  const { camera, gl } = useThree();
  const current = useRef({ x: 0, y: 0, zoom: 1 });
  const zoomTarget = useRef(1);
  const followEnabled = useRef(true);
  const dragState = useRef({ active: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    followEnabled.current = true;
  }, [selectedId]);

  useEffect(() => {
    zoomTarget.current = Math.max(0.6, Math.min(2.2, externalZoom / 100));
  }, [externalZoom]);

  useEffect(() => {
    const dom = gl.domElement;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      zoomTarget.current = Math.max(0.6, Math.min(2.2, zoomTarget.current + delta));
    };

    const onPointerDown = (event: PointerEvent) => {
      dragState.current = { active: true, lastX: event.clientX, lastY: event.clientY };
      followEnabled.current = false;
      dom.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragState.current.active) return;
      const dx = event.clientX - dragState.current.lastX;
      const dy = event.clientY - dragState.current.lastY;
      dragState.current.lastX = event.clientX;
      dragState.current.lastY = event.clientY;
      const factor = 0.045 / current.current.zoom;
      current.current.x -= dx * factor;
      current.current.y += dy * factor;
    };

    const onPointerUp = (event: PointerEvent) => {
      dragState.current.active = false;
      dom.releasePointerCapture(event.pointerId);
    };

    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    return () => {
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
    };
  }, [gl]);

  useFrame((_state, delta) => {
    const dt = delta || 0.016;
    if (followEnabled.current) {
      const selected = simRef.current.get(selectedId);
      if (selected) {
        const [wx, wy] = toWorld(selected.x, selected.y);
        const rate = reducedMotion ? 20 : 3.2;
        current.current.x += (wx - current.current.x) * Math.min(1, rate * dt);
        current.current.y += (wy - current.current.y) * Math.min(1, rate * dt);
      }
    }
    const zoomRate = reducedMotion ? 20 : 4;
    current.current.zoom += (zoomTarget.current - current.current.zoom) * Math.min(1, zoomRate * dt);

    const distance = BASE_DISTANCE / current.current.zoom;
    camera.position.set(current.current.x, current.current.y - TILT * (1 / current.current.zoom) * 0.6, distance);
    camera.lookAt(current.current.x, current.current.y, 0);
  });

  return null;
}

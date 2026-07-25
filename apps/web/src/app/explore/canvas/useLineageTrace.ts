"use client";

import { useEffect, useRef, useState } from "react";
import type { TreeNode } from "../page";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LineageResponse = {
  lineagePath: Array<{ id: string; fullName: string }>;
};

/**
 * Ao selecionar uma pessoa, busca a cadeia raiz→pessoa no endpoint público
 * (o mesmo que o Story Mode já usa) e expõe:
 *   pathIds — ids dos nós do caminho, ordem raiz→selecionado
 *   traceT0 — performance.now() do momento da seleção (dispara a revelação
 *             sequencial nos LinkCurve/NodePortrait)
 *
 * Cache por entityId; seleção de nós não-pessoa limpa o trace.
 */
export function useLineageTrace(selected: TreeNode | undefined) {
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [traceT0, setTraceT0] = useState(0);
  const cacheRef = useRef(new Map<string, string[]>());

  const entityId = selected?.entityType === "person" ? selected.entityId : undefined;
  const selectedId = selected?.id;

  useEffect(() => {
    let cancelled = false;
    if (!entityId || !selectedId) {
      setPathIds([]);
      setTraceT0(0);
      return;
    }
    const cached = cacheRef.current.get(entityId);
    if (cached) {
      setPathIds(cached);
      setTraceT0(performance.now());
      return;
    }
    (async () => {
      try {
        const response = await fetch(`${apiBase}/public/people/${entityId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as LineageResponse;
        const ids = (payload.lineagePath ?? []).map((entry) => `person:${entry.id}`);
        // garante que o próprio selecionado esteja no fim, mesmo se o id local divergir
        if (ids.length && ids[ids.length - 1] !== selectedId) ids.push(selectedId);
        cacheRef.current.set(entityId, ids);
        if (!cancelled) {
          setPathIds(ids);
          setTraceT0(performance.now());
        }
      } catch {
        if (!cancelled) {
          // sem cadeia disponível: acende só o selecionado, sem escurecer o resto
          setPathIds([selectedId]);
          setTraceT0(performance.now());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, selectedId]);

  return { pathIds, traceT0 };
}

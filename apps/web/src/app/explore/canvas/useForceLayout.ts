"use client";

import { useEffect, useRef } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation } from "d3-force";
import type { ApiLink, TreeNode } from "../page";
import { SIM_RADIUS } from "./space";

export type SimNode = {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  seedX: number;
  seedY: number;
  radius: number;
};

type Bucket = "center" | "up" | "down" | "left" | "right";

/**
 * Same semantic grouping as the previous DOM layout (instructors above,
 * students below, sources/teams to the sides) — kept as the physics
 * simulation's anchor so the force-directed result still reads as a family
 * tree instead of a generic node cloud.
 */
function seedLayout(nodes: TreeNode[], links: ApiLink[], rootId: string) {
  const seeds = new Map<string, { x: number; y: number }>();
  if (!nodes.length) return seeds;
  const root = nodes.some((node) => node.id === rootId) ? rootId : nodes[0].id;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const linkByPair = new Map<string, ApiLink>();
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node.id, []));
  links.forEach((link) => {
    if (!adjacency.has(link.from) || !adjacency.has(link.to)) return;
    adjacency.get(link.from)!.push(link.to);
    adjacency.get(link.to)!.push(link.from);
    linkByPair.set(`${link.from}->${link.to}`, link);
    linkByPair.set(`${link.to}->${link.from}`, link);
  });

  const depth = new Map<string, number>([[root, 0]]);
  const parent = new Map<string, string>();
  const queue = [root];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, (depth.get(current) ?? 0) + 1);
      parent.set(next, current);
      queue.push(next);
    }
  }

  const firstHopFor = (nodeId: string) => {
    let current = nodeId;
    let previous = parent.get(current);
    while (previous && previous !== root) {
      current = previous;
      previous = parent.get(current);
    }
    return previous === root ? current : nodeId;
  };

  const bucketFor = (node: TreeNode): Bucket => {
    if (node.id === root) return "center";
    const firstHop = firstHopFor(node.id);
    const firstNode = nodeById.get(firstHop) ?? node;
    const rootLink = linkByPair.get(`${root}->${firstHop}`);
    if (rootLink?.to === root) return "up";
    if (firstNode.entityType.includes("external") || firstNode.entityType.includes("source") || firstNode.entityType.includes("fact")) return "left";
    if (firstNode.entityType.includes("team") || firstNode.entityType.includes("organization") || firstNode.entityType.includes("affiliation")) return "right";
    return "down";
  };

  const groups = new Map<string, TreeNode[]>();
  nodes.forEach((node) => {
    const bucket = bucketFor(node);
    if (bucket === "center") return;
    const nodeDepth = Math.min(depth.get(node.id) ?? 3, 3);
    const key = `${bucket}:${nodeDepth}`;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  const spread = (index: number, total: number, min: number, max: number) => {
    if (total <= 1) return (min + max) / 2;
    return min + ((max - min) / (total - 1)) * index;
  };

  nodes.forEach((node) => {
    if (node.id === root) {
      seeds.set(node.id, { x: 50, y: 57 });
      return;
    }
    const bucket = bucketFor(node);
    const nodeDepth = Math.min(depth.get(node.id) ?? 3, 3);
    const siblings = groups.get(`${bucket}:${nodeDepth}`) ?? [node];
    const index = Math.max(0, siblings.findIndex((entry) => entry.id === node.id));

    if (bucket === "up") {
      seeds.set(node.id, { x: spread(index, siblings.length, 34, 66), y: Math.max(12, 47 - nodeDepth * 13) });
    } else if (bucket === "left") {
      seeds.set(node.id, { x: Math.max(13, 39 - nodeDepth * 12), y: spread(index, siblings.length, 32, 78) });
    } else if (bucket === "right") {
      seeds.set(node.id, { x: Math.min(87, 61 + nodeDepth * 12), y: spread(index, siblings.length, 32, 78) });
    } else {
      seeds.set(node.id, { x: spread(index, siblings.length, 30, 70), y: Math.min(88, 66 + nodeDepth * 10) });
    }
  });

  return seeds;
}

/**
 * Runs a live d3-force simulation anchored to the seed layout above.
 * Returns a ref to a stable id -> SimNode map: d3's own internal ticker
 * mutates x/y on those objects every animation frame, so canvas consumers
 * can read live positions inside their own useFrame without extra plumbing.
 */
export function useForceLayout(
  nodes: TreeNode[],
  links: ApiLink[],
  rootId: string,
  onPositions?: (positions: Record<string, { x: number; y: number }>) => void
) {
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const nodeMapRef = useRef<Map<string, SimNode>>(new Map());
  const lastReportRef = useRef(0);
  const onPositionsRef = useRef(onPositions);
  onPositionsRef.current = onPositions;

  useEffect(() => {
    if (!nodes.length) return;
    const seeds = seedLayout(nodes, links, rootId);
    const map = nodeMapRef.current;
    const idsNow = new Set(nodes.map((node) => node.id));

    const parentIdOf = new Map<string, string>();
    links.forEach((link) => {
      if (!parentIdOf.has(link.to)) parentIdOf.set(link.to, link.from);
    });

    // New siblings spawning under the same parent in this batch: fan them out around the
    // parent by angle instead of dropping them all near the same random point. Otherwise they
    // spend the first second or two as a dense overlapping clump while collision force sorts
    // them out — which reads as the tree "opening on top of itself".
    const newSiblingIndex = new Map<string, number>();
    const newSiblingCount = new Map<string, number>();
    nodes.forEach((node) => {
      if (map.has(node.id)) return;
      const parentId = parentIdOf.get(node.id) ?? "";
      const index = newSiblingCount.get(parentId) ?? 0;
      newSiblingIndex.set(node.id, index);
      newSiblingCount.set(parentId, index + 1);
    });

    const simNodes: SimNode[] = nodes.map((node) => {
      const seed = seeds.get(node.id) ?? { x: 50, y: 57 };
      const existing = map.get(node.id);
      if (existing) {
        existing.seedX = seed.x;
        existing.seedY = seed.y;
        existing.radius = SIM_RADIUS[node.size];
        return existing;
      }
      const parentId = parentIdOf.get(node.id) ?? "";
      const parentPos = map.get(parentId);
      const index = newSiblingIndex.get(node.id) ?? 0;
      const total = newSiblingCount.get(parentId) ?? 1;
      const angle = (index / Math.max(total, 1)) * Math.PI * 2;
      const fanRadius = 7;
      const spawn: SimNode = {
        id: node.id,
        x: parentPos ? parentPos.x + Math.cos(angle) * fanRadius : seed.x,
        y: parentPos ? parentPos.y + Math.sin(angle) * fanRadius : seed.y,
        vx: 0,
        vy: 0,
        seedX: seed.x,
        seedY: seed.y,
        radius: SIM_RADIUS[node.size]
      };
      map.set(node.id, spawn);
      return spawn;
    });

    Array.from(map.keys()).forEach((id) => {
      if (!idsNow.has(id)) map.delete(id);
    });

    const simLinks = links
      .filter((link) => idsNow.has(link.from) && idsNow.has(link.to))
      .map((link) => ({ source: link.from, target: link.to }));

    if (!simRef.current) {
      const sim = forceSimulation<SimNode>(simNodes)
        .force("charge", forceManyBody().strength(-22))
        .force("collide", forceCollide<SimNode>((d) => d.radius + 2.2))
        .force("seedX", forceX<SimNode>((d) => d.seedX).strength(0.14))
        .force("seedY", forceY<SimNode>((d) => d.seedY).strength(0.14))
        .force("link", forceLink<SimNode, { source: string; target: string }>(simLinks).id((d) => d.id).distance(15).strength(0.5))
        .alphaDecay(0.045)
        .on("tick", () => {
          const now = performance.now();
          if (onPositionsRef.current && now - lastReportRef.current > 120) {
            lastReportRef.current = now;
            const out: Record<string, { x: number; y: number }> = {};
            map.forEach((value, key) => {
              out[key] = { x: value.x, y: value.y };
            });
            onPositionsRef.current(out);
          }
        });
      simRef.current = sim;
    } else {
      simRef.current.nodes(simNodes);
      const linkForce = simRef.current.force("link") as ReturnType<typeof forceLink<SimNode, { source: string; target: string }>>;
      linkForce.links(simLinks);
    }
    simRef.current.alpha(0.9).restart();
  }, [nodes, links, rootId]);

  useEffect(
    () => () => {
      simRef.current?.stop();
    },
    []
  );

  return nodeMapRef;
}

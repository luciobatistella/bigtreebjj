import type { ApiLink, TreeNode } from "../page";

/**
 * Layout de linhagem a partir do grafo do API (nodes + links, from = professor,
 * to = aluno — mesma convenção do seedLayout do useForceLayout):
 *
 *   - ANCESTRAIS: cadeia em coluna única ACIMA do root (professor do professor…)
 *   - DESCENDENTES: tidy tree ABAIXO do root (alunos, alunos dos alunos…)
 *
 * Módulo puro (sem React/DOM) para ser testável isoladamente.
 */

export const CARD_W = 150;
export const CARD_H = 112;
export const GAP_X = 28;
export const LEVEL_H = 172;
const SLOT = CARD_W + GAP_X;

export type PlacedNode = {
  node: TreeNode;
  x: number;
  y: number;
  depth: number; // 0 = root; negativo = ancestral
  isAncestor: boolean;
  parentId?: string;
  childIds: string[];
};

export type PlacedEdge = {
  id: string;
  fromId: string; // professor (em cima)
  toId: string;   // aluno (embaixo)
  link: ApiLink;
};

export type LineageLayout = {
  placed: Map<string, PlacedNode>;
  edges: PlacedEdge[];
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
};

export function buildLineageLayout(
  nodes: TreeNode[],
  links: ApiLink[],
  rootId: string
): LineageLayout {
  const placed = new Map<string, PlacedNode>();
  const edges: PlacedEdge[] = [];
  const empty = { placed, edges, bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  if (!nodes.length) return empty;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = byId.get(rootId) ?? nodes[0];

  // índice: professores de X (links com to === X) e alunos de X (from === X)
  const teachersOf = new Map<string, ApiLink[]>();
  const studentsOf = new Map<string, ApiLink[]>();
  links.forEach((link) => {
    if (!byId.has(link.from) || !byId.has(link.to)) return;
    if (link.from === link.to) return;
    (teachersOf.get(link.to) ?? teachersOf.set(link.to, []).get(link.to)!).push(link);
    (studentsOf.get(link.from) ?? studentsOf.set(link.from, []).get(link.from)!).push(link);
  });

  // ---- cadeia de ancestrais (root -> cima), com guarda de ciclo ----
  const ancestorChain: { node: TreeNode; via: ApiLink }[] = [];
  const seenUp = new Set<string>([root.id]);
  let cursorUp: TreeNode = root;
  for (let i = 0; i < 40; i += 1) {
    const upLinks = teachersOf.get(cursorUp.id) ?? [];
    const next = upLinks
      .map((link) => ({ node: byId.get(link.from), via: link }))
      .find((entry): entry is { node: TreeNode; via: ApiLink } => !!entry.node && !seenUp.has(entry.node.id));
    if (!next) break;
    seenUp.add(next.node.id);
    ancestorChain.push(next);
    cursorUp = next.node;
  }

  const ancestorIds = new Set(ancestorChain.map((entry) => entry.node.id));

  // ---- descendentes: BFS from -> to, sem revisitar nem subir em ancestrais ----
  const childIdsOf = new Map<string, string[]>();
  const parentOf = new Map<string, { id: string; via: ApiLink }>();
  const visited = new Set<string>([root.id, ...ancestorIds]);
  const queue: string[] = [root.id];
  while (queue.length) {
    const current = queue.shift()!;
    const kids: string[] = [];
    for (const link of studentsOf.get(current) ?? []) {
      const childId = link.to;
      if (visited.has(childId)) continue;
      visited.add(childId);
      kids.push(childId);
      parentOf.set(childId, { id: current, via: link });
      queue.push(childId);
    }
    childIdsOf.set(current, kids);
  }

  // ---- tidy layout dos descendentes ----
  let cursor = 0;
  const position = new Map<string, { x: number; y: number; depth: number }>();
  const placeDown = (id: string, depth: number): number => {
    const kids = childIdsOf.get(id) ?? [];
    let x: number;
    if (!kids.length) {
      x = cursor;
      cursor += SLOT;
    } else {
      const xs = kids.map((kid) => placeDown(kid, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    position.set(id, { x, y: depth * LEVEL_H, depth });
    return x;
  };
  placeDown(root.id, 0);

  // centraliza o root em x=0
  const rootX = position.get(root.id)!.x;
  position.forEach((value) => {
    value.x -= rootX;
  });

  // ---- ancestrais em coluna acima do root ----
  ancestorChain.forEach((entry, index) => {
    position.set(entry.node.id, { x: 0, y: -(index + 1) * LEVEL_H, depth: -(index + 1) });
  });

  // ---- materializa nós ----
  position.forEach((value, id) => {
    const node = byId.get(id);
    if (!node) return;
    const isAncestor = ancestorIds.has(id);
    const parent = isAncestor
      ? undefined // preenchido abaixo pela cadeia
      : parentOf.get(id)?.id;
    placed.set(id, {
      node,
      x: value.x,
      y: value.y,
      depth: value.depth,
      isAncestor,
      parentId: parent,
      childIds: childIdsOf.get(id) ?? []
    });
  });
  // parentId dos ancestrais: o de cima na cadeia
  ancestorChain.forEach((entry, index) => {
    const self = placed.get(entry.node.id);
    if (!self) return;
    const above = ancestorChain[index + 1];
    self.parentId = above?.node.id;
    self.childIds = [index === 0 ? root.id : ancestorChain[index - 1].node.id];
  });
  const rootPlaced = placed.get(root.id);
  if (rootPlaced && ancestorChain.length) rootPlaced.parentId = ancestorChain[0].node.id;

  // ---- arestas ----
  // cadeia de ancestrais (de cima para baixo até o root)
  for (let i = ancestorChain.length - 1; i >= 0; i -= 1) {
    const teacher = ancestorChain[i].node.id;
    const student = i === 0 ? root.id : ancestorChain[i - 1].node.id;
    const via = i === 0 ? ancestorChain[0].via : ancestorChain[i - 1].via;
    edges.push({ id: via.id, fromId: teacher, toId: student, link: via });
  }
  // descendentes
  parentOf.forEach((parent, childId) => {
    edges.push({ id: parent.via.id, fromId: parent.id, toId: childId, link: parent.via });
  });

  // ---- bbox ----
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  placed.forEach((entry) => {
    minX = Math.min(minX, entry.x - CARD_W / 2);
    maxX = Math.max(maxX, entry.x + CARD_W / 2);
    minY = Math.min(minY, entry.y - CARD_H / 2);
    maxY = Math.max(maxY, entry.y + CARD_H / 2);
  });
  if (!isFinite(minX)) return empty;

  return { placed, edges, bbox: { minX, maxX, minY, maxY } };
}

/** Caminho SVG (cúbica vertical) entre a base de um card e o topo do outro. */
export function edgePath(fx: number, fy: number, tx: number, ty: number): string {
  const startY = fy + CARD_H / 2;
  const endY = ty - CARD_H / 2;
  const midY = (startY + endY) / 2;
  return `M ${fx} ${startY} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${endY}`;
}

export const WORLD_SCALE = 46;

export function toWorld(pctX: number, pctY: number): [number, number] {
  return [((pctX - 50) / 100) * WORLD_SCALE, ((50 - pctY) / 100) * WORLD_SCALE];
}

export const STATUS_COLOR = {
  verified: "#44b06f",
  pending: "#e2a940",
  historical: "#aa9a80"
} as const;

export const SIM_RADIUS = { sm: 2.4, md: 3.4, lg: 5.2 } as const;
export const MESH_RADIUS = { sm: 0.9, md: 1.4, lg: 2.2 } as const;

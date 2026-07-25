import MotionForest from "./motion/MotionForest";
import { getServerLocale } from "../i18n/serverLocale";

// Tipos ainda importados (type-only) pelos módulos legados em ./canvas e ./tree —
// mantidos aqui até essa limpeza acontecer. A página em si agora é só o MotionForest.
export type NodeStatus = "verified" | "pending" | "historical";

export type ApiNode = {
  id: string;
  entityType: string;
  entityId?: string;
  name: string;
  subtitle: string;
  description: string;
  status: NodeStatus;
  sourceUrl?: string;
  profileHref?: string;
  blackBeltsAwarded?: number;
  expandable?: boolean;
};

export type ApiLink = {
  id: string;
  from: string;
  to: string;
  label: string;
  status: NodeStatus;
  evidenceLevel?: string;
  confidenceScore?: number;
  sourceCount?: number;
};

export type TreeNode = ApiNode & {
  x: number;
  y: number;
  size: "sm" | "md" | "lg";
  loaded?: boolean;
};

export default function ExplorePage() {
  const locale = getServerLocale();
  return <MotionForest locale={locale} />;
}

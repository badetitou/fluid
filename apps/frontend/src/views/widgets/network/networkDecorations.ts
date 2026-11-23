import { edgeKey, type DecoratedEdge, type DecoratedGraph, type DecoratedNode } from '@fluid/shared';
import { tagColor, worstSeverity, type DecorationIndex, type Severity } from '../../plugin-api/decorationModel';
import type { NetworkEdge, NetworkNode } from './networkModel';

// Pure logic of the decorations the network shows: the graph decorators read,
// and how their findings change the look of nodes and edges.

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** The graph decorators evaluate: one node per network node, one edge per link. */
export function toDecoratedGraph(nodes: NetworkNode[], edges: NetworkEdge[]): DecoratedGraph {
  return {
    nodes: nodes.map((n): DecoratedNode => {
      const tags = Array.isArray(n.row.tags) && n.row.tags.every((t) => typeof t === 'string') ? (n.row.tags as string[]) : undefined;
      const node: DecoratedNode = { key: n.key, name: n.label, props: n.row };
      const kind = str(n.row.kind);
      const fineKind = str(n.row.fineKind);
      const file = str(n.row.file);
      const language = str(n.row.language);
      if (kind !== undefined) node.kind = kind;
      if (fineKind !== undefined) node.fineKind = fineKind;
      if (file !== undefined) node.file = file;
      if (language !== undefined) node.language = language;
      if (typeof n.row.external === 'boolean') node.external = n.row.external;
      if (tags) node.tags = tags;
      return node;
    }),
    edges: edges.map((e) => ({ key: e.key, from: e.source, to: e.target, kind: '' })),
  };
}

export interface EdgeOverride {
  color: string;
  size: number;
}

export interface DecorationOverrides {
  /** Colors of the nodes with findings (worst severity). */
  nodeColors: Map<string, string>;
  /** Factor applied to the size of the nodes with findings. */
  nodeScale: Map<string, number>;
  /** Colors and sizes of the edges with findings, and of the derived edges. */
  edges: Map<string, EdgeOverride>;
}

export const NODE_FINDING_SCALE = 1.5;
const EDGE_FINDING_SIZE = 2.5;

export type StatusColors = Record<Severity, string>;

/** How the findings change the drawing; every map is empty when there is nothing to show. */
export function decorationOverrides(index: DecorationIndex, status: StatusColors): DecorationOverrides {
  const out: DecorationOverrides = { nodeColors: new Map(), nodeScale: new Map(), edges: new Map() };
  // Sigma has no dashed edges: derived edges get the info color instead.
  for (const e of index.derivedEdges) out.edges.set(edgeKey(e), { color: status.info, size: 1 });
  for (const [key, d] of index.nodes) {
    const worst = worstSeverity(d.findings);
    if (!worst) continue;
    out.nodeColors.set(key, status[worst]);
    out.nodeScale.set(key, NODE_FINDING_SCALE);
  }
  for (const [key, d] of index.edges) {
    const worst = worstSeverity(d.findings);
    if (worst) out.edges.set(key, { color: status[worst], size: EDGE_FINDING_SIZE });
  }
  return out;
}

/** Derived edges that can be drawn: both ends are among the nodes, and the edge is not already there. */
export function drawableDerivedEdges(
  derived: DecoratedEdge[],
  nodeKeys: ReadonlySet<string>,
  existing: ReadonlySet<string>,
): DecoratedEdge[] {
  const seen = new Set(existing);
  return derived.filter((e) => {
    const key = edgeKey(e);
    if (!nodeKeys.has(e.from) || !nodeKeys.has(e.to) || e.from === e.to || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The tags of the decorations, sorted, each with its color. */
export function decorationTags(index: DecorationIndex, series: string[]): { tag: string; color?: string }[] {
  const tags = new Set<string>();
  for (const d of index.nodes.values()) for (const t of d.tags) tags.add(t);
  return [...tags].sort().map((tag) => ({ tag, color: tagColor(tag, series) }));
}

/** Node colors and sizes with the overrides applied; the very same maps when there is none. */
export function withNodeOverrides(
  colors: Map<string, string>,
  sizes: Map<string, number>,
  o: DecorationOverrides,
): { colors: Map<string, string>; sizes: Map<string, number> } {
  if (o.nodeColors.size === 0) return { colors, sizes };
  return {
    colors: new Map([...colors, ...o.nodeColors]),
    sizes: new Map([...sizes].map(([key, size]) => [key, size * (o.nodeScale.get(key) ?? 1)])),
  };
}

/** The keys of the nodes carrying a tag. */
export function nodesWithTag(index: DecorationIndex, tag: string): Set<string> {
  return new Set([...index.nodes].filter(([, d]) => d.tags.includes(tag)).map(([key]) => key));
}

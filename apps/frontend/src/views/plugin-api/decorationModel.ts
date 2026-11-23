import type { DecoratedEdge, DecorationResult, Decoration, Finding } from '@fluid/shared';

// Pure logic of the decorations a widget shows: indexing by target, severity, tag colors.

export type Severity = Finding['severity'];

export const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export interface DecorationIndex {
  nodes: Map<string, Decoration>;
  edges: Map<string, Decoration>;
  derivedEdges: DecoratedEdge[];
}

export const EMPTY_DECORATION_INDEX: DecorationIndex = {
  nodes: new Map(),
  edges: new Map(),
  derivedEdges: [],
};

/** Decorations by node key and by edge key. */
export function indexDecorations(result: DecorationResult): DecorationIndex {
  const index: DecorationIndex = { nodes: new Map(), edges: new Map(), derivedEdges: result.derivedEdges };
  for (const d of result.decorations) {
    (d.target.type === 'node' ? index.nodes : index.edges).set(d.target.key, d);
  }
  return index;
}

/** The most severe of the findings; undefined when there are none. */
export function worstSeverity(findings: Pick<Finding, 'severity'>[]): Severity | undefined {
  return findings.reduce<Severity | undefined>(
    (worst, f) => (worst === undefined || SEVERITY_RANK[f.severity] < SEVERITY_RANK[worst] ? f.severity : worst),
    undefined,
  );
}

/** Number of findings per severity. */
export function severityCounts(findings: Pick<Finding, 'severity'>[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/** A stable color of the palette for a tag: the same tag always gets the same one. */
export function tagColor(tag: string, palette: string[]): string | undefined {
  if (palette.length === 0) return undefined;
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

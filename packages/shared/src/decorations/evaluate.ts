import { deriveEdges } from './derive';
import { checkConstraint, type Placed } from './constraints';
import {
  edgeKey,
  type DecoratedEdge,
  type DecoratedGraph,
  type Decoration,
  type DecorationResult,
} from './graph';
import type { Concept, DecoratorSpec } from './schema';
import { createMatchContext, matchSelector, nodeField, safeRegex } from './selector';

// Runs decorators on a graph, in three passes over all of them, so one
// decorator can build on another's tags (a rule set on top of a layer tagger):
// 1. concepts tag nodes (in order: a concept sees the tags of earlier ones),
// 2. derived edges join nodes (and may select on tags),
// 3. constraints produce findings on the graph plus the derived edges.

function conceptTags(concept: Concept, field: unknown): string[] {
  if (concept.tag !== undefined) return [concept.tag];
  const from = concept.tagFrom;
  if (!from || typeof field !== 'string') return [];
  const match = safeRegex(from.pattern)?.exec(field);
  if (!match) return [];
  const value = match[1] ?? match[0];
  return value ? [`${from.prefix ?? ''}${value}`] : [];
}

export function evaluateDecorators(
  specs: DecoratorSpec[],
  graph: DecoratedGraph,
): DecorationResult {
  const tags = new Map<string, Set<string>>();
  for (const node of graph.nodes) tags.set(node.key, new Set(node.tags ?? []));
  const tagsOf = (key: string): ReadonlySet<string> => tags.get(key) ?? new Set();
  const added = new Map<string, Set<string>>();
  // Tags change during the concept pass, so its context does not memoize.
  const conceptCtx = createMatchContext(graph.nodes, graph.edges, tagsOf, false);

  for (const spec of specs) {
    for (const concept of spec.concepts) {
      for (const node of graph.nodes) {
        const own = tags.get(node.key) as Set<string>;
        if (!matchSelector(node, conceptCtx, concept.match)) continue;
        const field = concept.tagFrom ? nodeField(node, concept.tagFrom.field) : undefined;
        for (const tag of conceptTags(concept, field)) {
          if (own.has(tag)) continue;
          own.add(tag);
          added.set(node.key, (added.get(node.key) ?? new Set()).add(tag));
        }
      }
    }
  }

  const deriveCtx = createMatchContext(graph.nodes, graph.edges, tagsOf, true);
  const known = new Set(graph.edges.map(edgeKey));
  const derivedEdges: DecoratedEdge[] = [];
  for (const spec of specs) {
    for (const rule of spec.derived) {
      for (const edge of deriveEdges(rule, graph.nodes, deriveCtx)) {
        if (known.has(edgeKey(edge))) continue;
        known.add(edgeKey(edge));
        derivedEdges.push(edge);
      }
    }
  }
  const edges = [...graph.edges, ...derivedEdges];
  const match = createMatchContext(graph.nodes, edges, tagsOf, true);

  const placed: Placed[] = specs.flatMap((spec) =>
    spec.constraints.flatMap((rule) =>
      checkConstraint(rule, {
        decoratorId: spec.id,
        nodes: graph.nodes,
        byKey: match.byKey,
        edges,
        match,
      }),
    ),
  );

  return { decorations: mergeDecorations(added, placed), derivedEdges };
}

function mergeDecorations(added: Map<string, Set<string>>, placed: Placed[]): Decoration[] {
  const byTarget = new Map<string, Decoration>();
  const at = (type: 'node' | 'edge', key: string): Decoration => {
    const id = `${type}:${key}`;
    let decoration = byTarget.get(id);
    if (!decoration) {
      decoration = { target: { type, key }, tags: [], findings: [] };
      byTarget.set(id, decoration);
    }
    return decoration;
  };
  for (const [key, set] of added) at('node', key).tags.push(...[...set].sort());
  for (const p of placed) at(p.type, p.key).findings.push(p.finding);
  return [...byTarget.values()];
}

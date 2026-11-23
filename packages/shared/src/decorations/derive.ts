import type { DecoratedEdge, DecoratedNode } from './graph';
import type { DerivedEdge } from './schema';
import { matchSelector, nodeField } from './selector';

// Derived edges: link nodes whose fields agree, e.g. a front-end call whose URL
// is the path of a back-end endpoint. Joined through a map, not pairwise.

/** A URL or route reduced to its path, with parameters as `*`: `/api/users/*`. */
export function normalizeUrl(value: string): string {
  const path = value
    .trim()
    .replace(/^[a-z]+:\/\/[^/]+/i, '')
    .replace(/[?#].*$/, '')
    .toLowerCase();
  const segments = path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => (/^(\{.*\}|:.+|\$\{.*\}|<.*>|\d+)$/.test(s) ? '*' : s));
  return `/${segments.join('/')}`;
}

function joinValues(node: DecoratedNode, field: string, normalize: 'exact' | 'url'): string[] {
  const raw = nodeField(node, field);
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
    .map((v) => (normalize === 'url' ? normalizeUrl(String(v)) : String(v)));
}

export function deriveEdges(
  rule: DerivedEdge,
  nodes: DecoratedNode[],
  tagsOf: (key: string) => ReadonlySet<string>,
): DecoratedEdge[] {
  const { normalize } = rule.join;
  const targets = new Map<string, string[]>();
  for (const node of nodes) {
    if (!matchSelector(node, tagsOf(node.key), rule.to)) continue;
    for (const value of joinValues(node, rule.join.to, normalize)) {
      targets.set(value, [...(targets.get(value) ?? []), node.key]);
    }
  }
  const edges: DecoratedEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!matchSelector(node, tagsOf(node.key), rule.from)) continue;
    for (const value of joinValues(node, rule.join.from, normalize)) {
      for (const to of targets.get(value) ?? []) {
        const key = `${node.key}->${to}:${rule.kind}`;
        if (to === node.key || seen.has(key)) continue;
        seen.add(key);
        edges.push({ key, from: node.key, to, kind: rule.kind });
      }
    }
  }
  return edges;
}

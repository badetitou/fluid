import type { DecoratedEdge, DecoratedNode } from './graph';
import type { DerivedEdge } from './schema';
import { matchSelector, nodeField, type MatchContext } from './selector';

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
    .map((v) => String(v))
    .filter((v) => v.trim().length > 0)
    .map((v) => (normalize === 'url' ? { raw: v, value: normalizeUrl(v) } : { raw: v, value: v }))
    .filter((v) => normalize !== 'url' || v.value !== '/' || v.raw.trim() === '/')
    .map((v) => v.value);
}

/** At most this many edges derived by one rule, so a loose join cannot blow up the graph. */
export const MAX_DERIVED_PER_RULE = 10000;

export function deriveEdges(
  rule: DerivedEdge,
  nodes: DecoratedNode[],
  ctx: MatchContext,
): DecoratedEdge[] {
  const { normalize } = rule.join;
  const targets = new Map<string, string[]>();
  for (const node of nodes) {
    if (!matchSelector(node, ctx, rule.to)) continue;
    for (const value of joinValues(node, rule.join.to, normalize)) {
      const list = targets.get(value);
      if (list) list.push(node.key);
      else targets.set(value, [node.key]);
    }
  }
  const edges: DecoratedEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!matchSelector(node, ctx, rule.from)) continue;
    for (const value of joinValues(node, rule.join.from, normalize)) {
      for (const to of targets.get(value) ?? []) {
        if (edges.length >= MAX_DERIVED_PER_RULE) return edges;
        const key = `${node.key}->${to}:${rule.kind}`;
        if (to === node.key || seen.has(key)) continue;
        seen.add(key);
        edges.push({ key, from: node.key, to, kind: rule.kind });
      }
    }
  }
  return edges;
}

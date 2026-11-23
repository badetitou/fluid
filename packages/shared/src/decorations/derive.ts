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

function fieldValues(node: DecoratedNode, field: string, normalize: 'exact' | 'url'): string[] {
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

/** A list-valued field gives a cross product; at most this many keys per node. */
export const MAX_JOIN_KEYS_PER_NODE = 100;

/**
 * The join keys of a node: the values of each field, combined and joined with
 * `\u0000`. A node missing one of the fields has no key (it is skipped). When
 * fields hold lists, the cross product is taken but capped at
 * MAX_JOIN_KEYS_PER_NODE keys, so a loose join cannot blow up.
 */
function joinKeys(node: DecoratedNode, fields: string | string[], normalize: 'exact' | 'url') {
  let keys: string[] = [''];
  const names = Array.isArray(fields) ? fields : [fields];
  for (const [i, field] of names.entries()) {
    const values = fieldValues(node, field, normalize);
    if (values.length === 0) return [];
    const next: string[] = [];
    for (const key of keys) {
      for (const value of values) {
        if (next.length >= MAX_JOIN_KEYS_PER_NODE) break;
        next.push(i === 0 ? value : `${key}\u0000${value}`);
      }
    }
    keys = next;
  }
  return keys;
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
    for (const value of joinKeys(node, rule.join.to, normalize)) {
      const list = targets.get(value);
      if (list) list.push(node.key);
      else targets.set(value, [node.key]);
    }
  }
  const edges: DecoratedEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!matchSelector(node, ctx, rule.from)) continue;
    for (const value of joinKeys(node, rule.join.from, normalize)) {
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

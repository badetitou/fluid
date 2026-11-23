import type { DecoratedNode } from './graph';
import type { Neighbours, Selector } from './schema';
import type { MatchContext } from './selector';

// The structural part of a selector: conditions on the neighbours of a node
// (`has`, `in`) and on its place in the `child` tree (`parent`, `ancestor`).

type Matcher = (node: DecoratedNode, ctx: MatchContext, s: Selector) => boolean;

/** How far up the `child` chain `ancestor` looks. */
export const MAX_ANCESTOR_DEPTH = 1000;

function neighbourCount(
  node: DecoratedNode,
  ctx: MatchContext,
  n: Neighbours,
  direction: 'out' | 'in',
  match: Matcher,
): boolean {
  const kinds = n.via && n.via.length > 0 ? new Set(n.via) : null;
  const edges = (direction === 'out' ? ctx.out : ctx.in).get(node.key) ?? [];
  let count = 0;
  for (const edge of edges) {
    if (kinds && !kinds.has(edge.kind ?? '')) continue;
    const other = ctx.byKey.get(direction === 'out' ? edge.to : edge.from);
    if (other && match(other, ctx, n.match)) count++;
  }
  return count >= (n.min ?? Math.min(1, n.max ?? 1)) && count <= (n.max ?? Infinity);
}

function parentsOf(node: DecoratedNode, ctx: MatchContext): DecoratedNode[] {
  return (ctx.in.get(node.key) ?? [])
    .filter((e) => e.kind === 'child')
    .flatMap((e) => ctx.byKey.get(e.from) ?? []);
}

/** Walks up the `child` edges; the visited set makes a cycle terminate. */
function hasAncestor(node: DecoratedNode, ctx: MatchContext, s: Selector, match: Matcher) {
  const seen = new Set([node.key]);
  let level = parentsOf(node, ctx);
  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && level.length > 0; depth++) {
    const next: DecoratedNode[] = [];
    for (const p of level) {
      if (seen.has(p.key)) continue;
      seen.add(p.key);
      if (match(p, ctx, s)) return true;
      next.push(...parentsOf(p, ctx));
    }
    level = next;
  }
  return false;
}

export function matchStructure(
  node: DecoratedNode,
  ctx: MatchContext,
  s: Selector,
  match: Matcher,
): boolean {
  if (s.has && !neighbourCount(node, ctx, s.has, 'out', match)) return false;
  if (s.in && !neighbourCount(node, ctx, s.in, 'in', match)) return false;
  const { parent, ancestor } = s;
  if (parent && !parentsOf(node, ctx).some((p) => match(p, ctx, parent))) return false;
  if (ancestor && !hasAncestor(node, ctx, ancestor, match)) return false;
  return true;
}

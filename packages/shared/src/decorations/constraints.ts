import { edgeKey, type DecoratedEdge, type DecoratedNode, type Finding } from './graph';
import type { Constraint } from './schema';
import { matchSelector, type MatchContext } from './selector';
import { adjacency, cycles, reachableFrom } from './traversal';

// Constraints → findings. Each check gives back where its findings go (node or
// edge keys); `evaluate.ts` merges them into decorations.

export interface Placed {
  type: 'node' | 'edge';
  key: string;
  finding: Finding;
}

export interface ConstraintContext {
  decoratorId: string;
  nodes: DecoratedNode[];
  byKey: ReadonlyMap<string, DecoratedNode>;
  edges: DecoratedEdge[];
  /** Selector context over the graph plus derived edges. */
  match: MatchContext;
}

/** At most this many related keys per finding, so huge graphs stay readable. */
export const MAX_RELATED = 20;

const nameOf = (ctx: ConstraintContext, key: string) => ctx.byKey.get(key)?.name ?? key;

/** `{source}` and `{target}` in a message become node names. */
function message(ctx: ConstraintContext, text: string, source: string, target?: string): string {
  return text
    .replaceAll('{source}', nameOf(ctx, source))
    .replaceAll('{target}', target === undefined ? '' : nameOf(ctx, target));
}

export function checkConstraint(rule: Constraint, ctx: ConstraintContext): Placed[] {
  const finding = (msg: string, related?: string[]): Finding => ({
    decoratorId: ctx.decoratorId,
    ruleId: rule.id,
    severity: rule.severity,
    message: msg,
    ...(related && related.length > 0 ? { related: related.slice(0, MAX_RELATED) } : {}),
  });
  const matching = (s: Parameters<typeof matchSelector>[2]) =>
    new Set(ctx.nodes.filter((n) => matchSelector(n, ctx.match, s)).map((n) => n.key));
  const adj = adjacency(ctx.edges, rule.via);

  switch (rule.check) {
    case 'node':
      return [...matching(rule.match)].map((key) => ({
        type: 'node',
        key,
        finding: finding(message(ctx, rule.message, key)),
      }));

    case 'required': {
      const to = matching(rule.to);
      return [...matching(rule.from)]
        .filter((key) => !(adj.get(key) ?? []).some((e) => to.has(e.to)))
        .map((key) => ({ type: 'node', key, finding: finding(message(ctx, rule.message, key)) }));
    }

    case 'forbidden': {
      const to = matching(rule.to);
      const placed: Placed[] = [];
      for (const source of matching(rule.from)) {
        if (rule.reachable) {
          const hits = [...reachableFrom(source, adj)].filter((k) => to.has(k) && k !== source);
          if (hits.length === 0) continue;
          const text = message(ctx, rule.message, source, hits[0]);
          placed.push({ type: 'node', key: source, finding: finding(text, hits) });
          continue;
        }
        const hits = (adj.get(source) ?? []).filter((e) => to.has(e.to));
        if (hits.length === 0) continue;
        for (const edge of hits) {
          const f = finding(message(ctx, rule.message, source, edge.to), [edge.to]);
          placed.push({ type: 'edge', key: edgeKey(edge), finding: f });
        }
        const targets = [...new Set(hits.map((e) => e.to))];
        const text = message(ctx, rule.message, source, targets[0]);
        placed.push({ type: 'node', key: source, finding: finding(text, targets) });
      }
      return placed;
    }

    case 'unreferenced': {
      const kinds = rule.via && rule.via.length > 0 ? new Set(rule.via) : null;
      const referenced = (key: string) =>
        (ctx.match.in.get(key) ?? []).some((e) => !kinds || kinds.has(e.kind ?? ''));
      return [...matching(rule.match)]
        .filter((key) => !referenced(key))
        .map((key) => ({ type: 'node', key, finding: finding(message(ctx, rule.message, key)) }));
    }

    case 'noCycle':
      return cycles(matching(rule.among), adj).flatMap((cycle) => {
        // Each node's finding names that node; edges name the cycle's first node.
        const onNode = (key: string) => finding(message(ctx, rule.message, key), cycle.nodes);
        const onEdge = onNode(cycle.nodes[0]);
        return [
          ...cycle.nodes.map((key): Placed => ({ type: 'node', key, finding: onNode(key) })),
          ...cycle.edges.map((key): Placed => ({ type: 'edge', key, finding: onEdge })),
        ];
      });
  }
}

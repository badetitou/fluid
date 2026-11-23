import { edgeKey, type DecoratedEdge } from './graph';

// Graph walks the constraints need: adjacency filtered by edge kinds, the nodes
// reachable from one node, and the strongly connected components (cycles).

export type Adjacency = Map<string, DecoratedEdge[]>;

export function adjacency(edges: DecoratedEdge[], via?: string[]): Adjacency {
  const kinds = via && via.length > 0 ? new Set(via) : null;
  const out: Adjacency = new Map();
  for (const edge of edges) {
    if (kinds && !kinds.has(edge.kind ?? '')) continue;
    const list = out.get(edge.from);
    if (list) list.push(edge);
    else out.set(edge.from, [edge]);
  }
  return out;
}

/** The nodes reachable from `start` by one or more edges (not `start` itself, unless on a cycle). */
export function reachableFrom(start: string, adj: Adjacency): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const edge of adj.get(current) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      stack.push(edge.to);
    }
  }
  return seen;
}

/**
 * The cycles of the subgraph made of `nodes`: each strongly connected component
 * with more than one node, or one node with an edge to itself, and its edges.
 * Iterative Tarjan, so deep graphs do not overflow the stack.
 */
export function cycles(
  nodes: ReadonlySet<string>,
  adj: Adjacency,
): { nodes: string[]; edges: string[] }[] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;
  const inside = (edge: DecoratedEdge) => nodes.has(edge.to);

  for (const root of nodes) {
    if (index.has(root)) continue;
    const work: { node: string; next: number }[] = [{ node: root, next: 0 }];
    index.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const out = (adj.get(frame.node) ?? []).filter(inside);
      if (frame.next < out.length) {
        const to = out[frame.next++].to;
        if (!index.has(to)) {
          index.set(to, counter);
          low.set(to, counter++);
          stack.push(to);
          onStack.add(to);
          work.push({ node: to, next: 0 });
        } else if (onStack.has(to)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(to)!));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop() as string;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.node);
        components.push(component);
      }
    }
  }

  return components.flatMap((component) => {
    const members = new Set(component);
    const edges = component.flatMap((n) =>
      (adj.get(n) ?? []).filter((e) => members.has(e.to)).map(edgeKey),
    );
    const isCycle = component.length > 1 || edges.length > 0;
    return isCycle ? [{ nodes: component.sort(), edges }] : [];
  });
}

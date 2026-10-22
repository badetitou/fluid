import type { Network, NetworkEdge } from './networkModel';

// Neighbourhoods in a network: the nodes around the hovered one (highlight) and
// the sub-network around the selected one (focus view).

export type FocusDirection = 'in' | 'out' | 'both';

/** Outgoing and incoming neighbours of every node. */
export interface Adjacency {
  out: Map<string, string[]>;
  in: Map<string, string[]>;
}

export function adjacencyOf(edges: NetworkEdge[]): Adjacency {
  const adjacency: Adjacency = { out: new Map(), in: new Map() };
  const push = (map: Map<string, string[]>, from: string, to: string) => {
    const list = map.get(from);
    if (list) list.push(to);
    else map.set(from, [to]);
  };
  for (const { source, target } of edges) {
    push(adjacency.out, source, target);
    push(adjacency.in, target, source);
  }
  return adjacency;
}

function stepsFrom(adjacency: Adjacency, key: string, direction: FocusDirection): string[] {
  const out = direction === 'in' ? [] : (adjacency.out.get(key) ?? []);
  const incoming = direction === 'out' ? [] : (adjacency.in.get(key) ?? []);
  return [...out, ...incoming];
}

/** The nodes at most `depth` links away from `start` (included), following `direction`. */
export function neighbourhood(
  adjacency: Adjacency,
  start: string,
  depth: number,
  direction: FocusDirection = 'both',
): Set<string> {
  const seen = new Set([start]);
  let frontier = [start];
  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const next: string[] = [];
    for (const key of frontier) {
      for (const neighbour of stepsFrom(adjacency, key, direction)) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return seen;
}

/** The part of the network around `start`: its neighbourhood and the edges between those nodes. */
export function focusNetwork(
  network: Network,
  start: string,
  depth: number,
  direction: FocusDirection = 'both',
): Network {
  if (!network.nodes.some((n) => n.key === start)) return network;
  const kept = neighbourhood(adjacencyOf(network.edges), start, depth, direction);
  return {
    nodes: network.nodes.filter((n) => kept.has(n.key)),
    edges: network.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
    groups: network.groups,
  };
}

import { DirectedGraph } from 'graphology';
import { seededPositions } from './layoutModel';
import { edgeKey, type DecoratedEdge } from '@fluid/shared';
import type { EdgeOverride } from './networkDecorations';
import type { Network } from './networkModel';

/** What decorations add to the graph: derived edges, and the look of some edges. */
export interface GraphDecor {
  derived: DecoratedEdge[];
  edges: ReadonlyMap<string, EdgeOverride>;
}

/** Attributes of a node in the graph handed to sigma (colors come from the reducers, from the theme). */
export interface NodeAttributes {
  label: string;
  size: number;
  x: number;
  y: number;
}

export type NetworkGraph = DirectedGraph<NodeAttributes>;

/** The graphology graph of a network, every node at its seeded starting position. */
export function networkGraph(network: Network, sizes: Map<string, number>, decor?: GraphDecor): NetworkGraph {
  const graph: NetworkGraph = new DirectedGraph<NodeAttributes>();
  const positions = seededPositions(network.nodes.map((n) => n.key));
  for (const node of network.nodes) {
    const { x, y } = positions.get(node.key) ?? { x: 0, y: 0 };
    graph.addNode(node.key, { label: node.label, size: sizes.get(node.key) ?? 4, x, y });
  }
  for (const edge of network.edges) graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, decor?.edges.get(edge.key));
  for (const e of decor?.derived ?? []) graph.addDirectedEdgeWithKey(edgeKey(e), e.from, e.to, decor?.edges.get(edgeKey(e)));
  return graph;
}

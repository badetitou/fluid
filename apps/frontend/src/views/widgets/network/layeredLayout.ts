import dagre from '@dagrejs/dagre';
import type { LayeredRequest, LayeredResponse } from './layoutModel';

// The layered (Sugiyama) layout of a network, with dagre. Runs in a web worker
// (`layered.worker.ts`); pure, so it is also tested directly.

const NODE_HEIGHT = 20;
const CHAR_WIDTH = 7;
const MAX_LABEL_WIDTH = 160;

/** Positions of the nodes in layers following the edges; y grows upwards, as in sigma. */
export function layeredPositions({ nodes, edges, direction }: LayeredRequest): LayeredResponse {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: direction, nodesep: 20, ranksep: 60, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    const width = Math.min(MAX_LABEL_WIDTH, 20 + node.label.length * CHAR_WIDTH);
    graph.setNode(node.key, direction === 'TB' ? { width, height: NODE_HEIGHT } : { width: NODE_HEIGHT * 2, height: NODE_HEIGHT });
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);
  const positions: LayeredResponse['positions'] = {};
  for (const key of graph.nodes()) {
    const { x, y } = graph.node(key);
    positions[key] = { x, y: -y };
  }
  return { positions };
}

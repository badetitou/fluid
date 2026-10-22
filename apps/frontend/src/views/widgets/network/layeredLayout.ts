import dagre from '@dagrejs/dagre';
import type { LayeredRequest, LayeredResponse } from './layoutModel';

// The layered (Sugiyama) layout of a network, with dagre. Runs in a web worker
// (`layered.worker.ts`); pure, so it is also tested directly.

const NODE_HEIGHT = 20;
const CHAR_WIDTH = 7;
const MAX_LABEL_WIDTH = 160;
/** Widest a layout may be relative to its depth before its layers are spread apart. */
const MAX_ASPECT = 2;

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
  const placed = graph.nodes().map((key) => ({ key, ...graph.node(key) }));
  const stretch = layerStretch(placed, direction);
  const positions: LayeredResponse['positions'] = {};
  for (const { key, x, y } of placed) {
    positions[key] = direction === 'TB' ? { x, y: -y * stretch } : { x: x * stretch, y: -y };
  }
  return { positions };
}

const span = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

/**
 * How much to spread the layers apart: a broad, shallow graph (hundreds of
 * subclasses under a few roots) is otherwise a thin strip once fitted to the view.
 */
function layerStretch(placed: { x: number; y: number }[], direction: LayeredRequest['direction']): number {
  const across = span(placed.map((p) => (direction === 'TB' ? p.x : p.y)));
  const along = span(placed.map((p) => (direction === 'TB' ? p.y : p.x)));
  return along > 0 ? Math.max(1, across / along / MAX_ASPECT) : 1;
}

import { DirectedGraph } from 'graphology';
import type { NodeAttributes } from '../network/networkGraph';
import type { HierarchyGraph } from './hierarchyModel';

/** The graphology graph sigma draws: one WebGL node per visible box, never one DOM node. */
export type SigmaExplorerGraph = DirectedGraph<NodeAttributes>;

/**
 * Boxes are drawn by the 2D canvas layer; sigma only needs the anchor point and
 * a small marker for each node. Keeping the marker small avoids distorting the
 * camera fit around large containment boxes.
 */
export function explorerGraph(hierarchy: HierarchyGraph): SigmaExplorerGraph {
  const graph: SigmaExplorerGraph = new DirectedGraph<NodeAttributes>();
  for (const node of hierarchy.nodes) {
    graph.addNode(node.key, {
      label: node.label,
      size: node.kind === 'container' ? 3 : 6,
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    });
  }
  for (const edge of hierarchy.edges) {
    if (!graph.hasEdge(edge.key)) graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target);
  }
  return graph;
}

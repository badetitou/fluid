import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import type { Network } from '../network/networkModel';

// React Flow's view of the explorer: stable node ids, positions coming from the
// graphology layout, and the two node variants (folded / expanded box).

export interface ExplorerNodeData extends Record<string, unknown> {
  label: string;
  group?: string;
  row: Record<string, unknown>;
  expanded: boolean;
  /** Composite node of a folded group, if any. */
  groupKey?: string;
  count?: number;
}

export type ExplorerFlowNode = Node<ExplorerNodeData, 'graphNode' | 'expandedNode'>;
export type Point = { x: number; y: number };

export interface FlowOptions {
  positions: ReadonlyMap<string, Point>;
  expanded: ReadonlySet<string>;
  focus?: string;
  direction?: 'TB' | 'LR';
}

/** Nodes and edges handed to React Flow. */
export function buildFlow(network: Network, options: FlowOptions): { nodes: ExplorerFlowNode[]; edges: Edge[] } {
  const source = options.direction === 'TB' ? Position.Bottom : Position.Right;
  const target = options.direction === 'TB' ? Position.Top : Position.Left;
  const nodes = network.nodes.map((node, index): ExplorerFlowNode => {
    const open = options.expanded.has(node.key);
    const at = options.positions.get(node.key) ?? { x: index * 180, y: 0 };
    return {
      id: node.key,
      type: open ? 'expandedNode' : 'graphNode',
      position: { x: at.x, y: at.y },
      data: {
        label: node.label,
        group: node.group,
        row: node.row,
        expanded: open,
        groupKey: node.key.startsWith('group:') ? node.key : undefined,
      },
      initialWidth: open ? 380 : 180,
      initialHeight: open ? 240 : 36,
      selected: options.focus === node.key,
      sourcePosition: source,
      targetPosition: target,
      draggable: true,
    };
  });
  const edges = network.edges.map(
    (edge): Edge => ({
      id: edge.key,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
    }),
  );
  return { nodes, edges };
}

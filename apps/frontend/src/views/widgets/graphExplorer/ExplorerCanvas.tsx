import { Background, Controls, ReactFlow, type Edge, type NodeTypes } from '@xyflow/react';
import { ExpandedNodeBox } from './ExpandedNodeBox';
import type { ExplorerFlowNode } from './graphExplorerFlow';
import { ExplorerNodeContext, type ExplorerNodeContextValue } from './GraphExplorerNodeContext';
import { ExplorerToolbar } from './ExplorerToolbar';
import { GraphNode } from './GraphNode';
import styles from './GraphExplorer.module.css';

const nodeTypes: NodeTypes = { graphNode: GraphNode, expandedNode: ExpandedNodeBox };

interface ExplorerCanvasProps {
  nodes: ExplorerFlowNode[];
  edges: Edge[];
  context: ExplorerNodeContextValue;
  height: number;
}

/** The graph itself: nodes are React elements, so an expanded node is a box in the graph. */
export function ExplorerCanvas({ nodes, edges, context, height }: ExplorerCanvasProps) {
  return (
    <div className={styles.frame} style={{ height }}>
      <ExplorerNodeContext.Provider value={context}>
        <ExplorerToolbar />
        <div className={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.1}
            maxZoom={2}
            onlyRenderVisibleElements={nodes.length > 300}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => context.select(node)}
            onNodeDoubleClick={(_, node) => {
              if (context.canExpand(node.data.row)) context.toggleExpanded(node.id);
            }}
          >
            <Background color="var(--ink-muted)" gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </ExplorerNodeContext.Provider>
    </div>
  );
}

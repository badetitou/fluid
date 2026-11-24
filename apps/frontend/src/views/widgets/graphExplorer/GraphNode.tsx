import { Button } from 'antd';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PlusOutlined } from '@ant-design/icons';
import { useExplorerNode } from './GraphExplorerNodeContext';
import type { ExplorerFlowNode } from './graphExplorerFlow';
import styles from './GraphExplorer.module.css';

/** A folded node: label, optional group and a button to open its detail box. */
export function GraphNode({ id, data, selected, sourcePosition, targetPosition }: NodeProps<ExplorerFlowNode>) {
  const node = useExplorerNode();
  const expandable = node.canExpand(data.row);
  return (
    <>
      <Handle type="target" position={targetPosition ?? Position.Left} isConnectable={false} />
      <div
        className={`${styles.node} ${selected ? styles.nodeSelected : ''} nodrag`}
        role="group"
        aria-label={data.label}
        onDoubleClick={() => expandable && node.toggleExpanded(id)}
      >
        {expandable && (
          <Button
            type="text"
            size="small"
            className="nodrag"
            aria-label={`Expand ${data.label}`}
            aria-expanded="false"
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              node.toggleExpanded(id);
            }}
          />
        )}
        <span>{data.label}</span>
        {data.group && <span className={styles.group}>{data.group}</span>}
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right} isConnectable={false} />
    </>
  );
}

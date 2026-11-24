import { useMemo } from 'react';
import { Alert, Button, Skeleton } from 'antd';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MinusOutlined } from '@ant-design/icons';
import { GRAPH_DETAIL_QUERY, GRAPH_NODE_QUERY } from '@fluid/shared';
import { z } from 'zod';
import { scopedResolver } from '../../data';
import { useNodeDetail } from '../../useNodeDetail';
import { ExpandedNodeBody } from './ExpandedNodeBody';
import type { ExplorerFlowNode } from './graphExplorerFlow';
import { useExplorerNode } from './GraphExplorerNodeContext';
import { detailId } from './graphExplorerModel';
import styles from './GraphExplorer.module.css';

const rowSchema = z.record(z.string(), z.unknown());
const detailSchema = z.union([rowSchema, z.array(rowSchema), z.null()]);

/** An expanded node: a box drawn inside the graph, containing its own detail widgets. */
export function ExpandedNodeBox({ id, data, selected, sourcePosition, targetPosition }: NodeProps<ExplorerFlowNode>) {
  const explorer = useExplorerNode();
  const { widget } = explorer;
  const nodeId = detailId(widget, data.row);
  const detail = useNodeDetail({
    queryKey: widget.detailQuery,
    path: widget.detailPath,
    nodeId: widget.detailQuery ? nodeId : undefined,
    enabled: !!widget.detailQuery && !!nodeId,
    schema: detailSchema,
  });
  const resolve = useMemo(
    () => scopedResolver({ [GRAPH_NODE_QUERY]: data.row, [GRAPH_DETAIL_QUERY]: detail.data }, explorer.resolve),
    [data.row, detail.data, explorer.resolve],
  );
  return (
    <>
      <Handle type="target" position={targetPosition ?? Position.Left} isConnectable={false} />
      <div
        className={`${styles.expanded} ${selected ? styles.expandedSelected : ''}`}
        role="group"
        aria-label={data.label}
      >
        <div className={`${styles.header} nodrag`}>
          <Button
            type="text"
            size="small"
            aria-label={`Collapse ${data.label}`}
            aria-expanded="true"
            icon={<MinusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              explorer.toggleExpanded(id);
            }}
          />
          <span className={styles.title}>{data.label}</span>
          {data.group && <span className={styles.group}>{data.group}</span>}
        </div>
        {detail.loading && (
          <div className={styles.loading}>
            <Skeleton active />
          </div>
        )}
        {detail.error && <Alert type="error" showIcon message="Detail query failed" description={detail.error.message} />}
        <ExpandedNodeBody widgets={widget.widgets ?? []} nodeKey={id} resolve={resolve} />
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right} isConnectable={false} />
    </>
  );
}

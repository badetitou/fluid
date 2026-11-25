import { useMemo } from 'react';
import { Alert, Button, Skeleton } from 'antd';
import { MinusOutlined } from '@ant-design/icons';
import { GRAPH_DETAIL_QUERY, GRAPH_NODE_QUERY } from '@fluid/shared';
import { z } from 'zod';
import { scopedResolver } from '../../data';
import { useNodeDetail } from '../../useNodeDetail';
import { ExpandedNodeBody } from './ExpandedNodeBody';
import { useExplorerNode } from './GraphExplorerNodeContext';
import { detailId } from './graphExplorerModel';
import type { HierarchyNode } from './hierarchyModel';
import styles from './GraphExplorer.module.css';

const rowSchema = z.record(z.string(), z.unknown());
const detailSchema = z.union([rowSchema, z.array(rowSchema), z.null()]);

export interface CardPlacement {
  left: number;
  top: number;
  scale: number;
}

interface ExpandedNodeBoxProps {
  node: HierarchyNode;
  placement: CardPlacement;
  /** At low zoom the canvas draws the box but widgets stay hidden to avoid unreadable text. */
  compact: boolean;
}

/**
 * The only DOM content of an expanded node. It is anchored to the box drawn by
 * the canvas layer, so the widgets live inside the graph instead of floating on
 * top of it. The camera transform keeps them exactly aligned while panning.
 */
export function ExpandedNodeBox({ node, placement, compact }: ExpandedNodeBoxProps) {
  const explorer = useExplorerNode();
  const { widget } = explorer;
  const nodeId = detailId(widget, node.row);
  const detail = useNodeDetail({
    queryKey: widget.detailQuery,
    path: widget.detailPath,
    nodeId: widget.detailQuery ? nodeId : undefined,
    enabled: !!widget.detailQuery && !!nodeId && !compact,
    schema: detailSchema,
  });
  const resolve = useMemo(
    () => scopedResolver({ [GRAPH_NODE_QUERY]: node.row, [GRAPH_DETAIL_QUERY]: detail.data }, explorer.resolve),
    [node.row, detail.data, explorer.resolve],
  );
  return (
    <div
      className={styles.cardLayer}
      style={{
        left: placement.left,
        top: placement.top,
        width: node.width * placement.scale,
        height: node.height * placement.scale,
      }}
    >
      <div
        className={`${styles.expanded} ${explorer.session.overrides?.selectedKey === node.key ? styles.expandedSelected : ''}`}
        role="group"
        aria-label={node.label}
        style={{ width: node.width, height: node.height, transform: `scale(${placement.scale})`, transformOrigin: 'top left' }}
      >
        <div className={styles.header}>
          <Button
            type="text"
            size="small"
            aria-label={`Collapse ${node.label}`}
            aria-expanded="true"
            icon={<MinusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              explorer.toggleExpanded(node.key);
            }}
          />
          <span className={styles.title}>{node.label}</span>
          {node.group && <span className={styles.group}>{node.group}</span>}
        </div>
        {!compact && detail.loading && (
          <div className={styles.loading}>
            <Skeleton active />
          </div>
        )}
        {!compact && detail.error && (
          <Alert type="error" showIcon message="Detail query failed" description={detail.error.message} />
        )}
        {!compact && (
          <ExpandedNodeBody widgets={widget.widgets ?? []} nodeKey={node.key} resolve={resolve} />
        )}
      </div>
    </div>
  );
}

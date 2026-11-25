import { Button, Tag } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { useExplorerNode } from './GraphExplorerNodeContext';
import type { HierarchyNode } from './hierarchyModel';
import styles from './GraphExplorer.module.css';

interface ExplorerNodeCardProps {
  node: HierarchyNode;
  at: { x: number; y: number };
  frameWidth: number;
  frameHeight: number;
}

const OFFSET = 14;

/** A single DOM card for the hovered/selected node: the expand affordance at any scale. */
export function ExplorerNodeCard({ node, at, frameWidth, frameHeight }: ExplorerNodeCardProps) {
  const explorer = useExplorerNode();
  const open = node.kind === 'leaf' ? explorer.session.expanded.includes(node.key) : !explorer.session.collapsedGroups.includes(node.key);
  const left = Math.max(8, Math.min(at.x + OFFSET, frameWidth - 230));
  const top = Math.max(8, Math.min(at.y + OFFSET, frameHeight - 110));
  return (
    <div className={styles.nodeCard} style={{ left, top }} role="tooltip">
      <div className={styles.nodeCardTitle}>{node.label}</div>
      <Tag variant="filled" className={styles.nodeCardKind}>
        {node.kind === 'container' ? `${node.count} nodes` : node.group ?? 'node'}
      </Tag>
      {node.expandable && (
        <Button
          type="text"
          size="small"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
          aria-expanded={open}
          icon={open ? <MinusOutlined /> : <PlusOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            explorer.toggleExpanded(node.key);
          }}
        >
          {open ? 'Collapse' : 'Expand'}
        </Button>
      )}
    </div>
  );
}

import { Button, Select, Tag } from 'antd';
import { useExplorerNode } from './GraphExplorerNodeContext';
import styles from './GraphExplorer.module.css';

/** Session-only controls of an explorer: fold boxes, focus on a node, close the cards. */
export function ExplorerToolbar() {
  const explorer = useExplorerNode();
  const { session } = explorer;
  const selectedKey = session.overrides?.selectedKey;
  const canFocus = !!session.focus || typeof selectedKey === 'string';
  const canCollapse = session.expanded.length > 0 || session.collapsedGroups.length > 0;
  return (
    <div className={`${styles.toolbar} nodrag nowheel`}>
      <Tag variant="filled">
        {explorer.total - explorer.hidden}/{explorer.total} nodes
      </Tag>
      {explorer.groups.length > 0 && (
        <Select
          mode="multiple"
          allowClear
          className={styles.groupSelect}
          placeholder="Fold boxes"
          aria-label="Fold boxes"
          maxTagCount="responsive"
          value={session.collapsedGroups}
          onChange={(keys: string[]) => explorer.setSession({ collapsedGroups: keys })}
          options={explorer.groups.map((key) => ({
            value: key,
            label: explorer.hierarchy.containers.find((box) => box.key === key)?.label ?? key,
          }))}
        />
      )}
      <Button type="text" size="small" disabled={!canFocus} onClick={explorer.toggleFocus}>
        {session.focus ? 'Clear focus' : 'Focus selection'}
      </Button>
      <Button type="text" size="small" disabled={!canCollapse} onClick={explorer.collapseAll}>
        Collapse all
      </Button>
      <Button
        type="text"
        size="small"
        disabled={session.collapsedGroups.length === 0}
        onClick={() => explorer.setSession({ collapsedGroups: [] })}
      >
        Expand all
      </Button>
    </div>
  );
}

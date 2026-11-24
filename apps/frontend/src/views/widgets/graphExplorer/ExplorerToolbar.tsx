import { Button, Select, Tag } from 'antd';
import { useExplorerNode } from './GraphExplorerNodeContext';
import styles from './GraphExplorer.module.css';

/** Session-only controls of an explorer: fold groups, focus on a node, close the boxes. */
export function ExplorerToolbar() {
  const explorer = useExplorerNode();
  const { session } = explorer;
  const selectedKey = session.overrides?.selectedKey;
  const canFocus = !!session.focus || typeof selectedKey === 'string';
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
          placeholder="Fold groups"
          aria-label="Fold groups"
          maxTagCount="responsive"
          value={session.collapsedGroups}
          onChange={(keys: string[]) => explorer.setSession({ collapsedGroups: keys })}
          options={explorer.groups.map((key) => ({ value: key, label: key.replace(/^group:/, '') }))}
        />
      )}
      <Button type="text" size="small" disabled={!canFocus} onClick={explorer.toggleFocus}>
        {session.focus ? 'Clear focus' : 'Focus selection'}
      </Button>
      <Button type="text" size="small" disabled={session.expanded.length === 0} onClick={explorer.collapseAll}>
        Collapse all
      </Button>
    </div>
  );
}

import { useMemo } from 'react';
import { Button } from 'antd';
import type { PageableNode } from './itemsModel';
import { tableRows, treeRows } from './model';
import type { SpecEnv } from './specEnv';
import { SpecRowsTable } from './SpecRowsTable';
import { useViewItems } from './useViewItems';
import styles from './SpecPresenter.module.css';

interface SpecItemsProps {
  node: PageableNode;
  env: SpecEnv;
}

/**
 * A list, columned list or tree, completed through the items route: a lazy
 * node loads its items at once, a node with a `total` offers the next page, a
 * tree item announcing children loads them when unfolded.
 */
export function SpecItems({ node, env }: SpecItemsProps) {
  const items = useViewItems(node, env.pageable.get(node), env.source?.items);
  const rows = useMemo(() => (node.kind === 'tree' ? treeRows(items.items) : tableRows(items.items)), [node.kind, items.items]);
  const columns = node.kind === 'list' ? [] : (node.columns ?? []);
  return (
    <div>
      <SpecRowsTable
        columns={columns}
        rows={rows}
        truncated={node.truncated}
        loading={items.loading}
        onExpand={items.expand}
        interaction={env.interaction}
      />
      {items.missing > 0 && (
        <div className={styles.hint}>
          {items.items.length} of {items.total} shown.{' '}
          <Button size="small" type="link" loading={items.loading} onClick={items.loadMore}>
            Load more
          </Button>
        </div>
      )}
      {items.error && <div className={styles.notice}>{items.error}</div>}
    </div>
  );
}

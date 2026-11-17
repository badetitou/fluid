import { Alert, Button, Space } from 'antd';
import type { RowsState } from './model';
import { LoadAllDialog } from './LoadAllDialog';
import { useLoadRows } from './useLoadRows';
import styles from './RowsBanner.module.css';

interface RowsBannerProps {
  rows: RowsState;
  load?: (kind: 'more' | 'all') => Promise<void>;
}

/**
 * Above a widget whose list may have been cut: how many rows are shown, and
 * how to load more or all — or, when the source answers no more at once and
 * cannot page, that this is all fluid can get.
 */
export function RowsBanner({ rows, load }: RowsBannerProps) {
  const { loading, loadMore, loadAll, dialog } = useLoadRows(load);
  const count = rows.loaded.toLocaleString();
  if (!rows.more || !load) {
    return (
      <Alert
        type="warning"
        showIcon
        className={styles.banner}
        title={`First ${count} rows — the source answers no more at once and cannot page this list.`}
      />
    );
  }
  return (
    <>
      <Alert
        type="info"
        showIcon
        className={styles.banner}
        title={`First ${count} rows — there may be more.`}
        action={
          <Space size="small">
            <Button size="small" loading={loading === 'more'} disabled={loading !== null} onClick={loadMore}>
              Load {rows.step.toLocaleString()} more
            </Button>
            <Button size="small" loading={loading === 'all'} disabled={loading !== null} onClick={loadAll}>
              Load all
            </Button>
          </Space>
        }
      />
      <LoadAllDialog {...dialog} loaded={rows.loaded} paged={rows.paged} />
    </>
  );
}

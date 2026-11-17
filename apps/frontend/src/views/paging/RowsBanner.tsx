import { Alert, Button, Space } from 'antd';
import type { RowsState } from './model';
import { LoadAllDialog } from './LoadAllDialog';
import { useLoadRows } from './useLoadRows';
import styles from './RowsBanner.module.css';

interface RowsBannerProps {
  rows: RowsState;
  load?: (kind: 'more' | 'all') => Promise<void>;
}

/** Above a widget whose list may have been cut: how many rows are shown, and how to load more or all. */
export function RowsBanner({ rows, load }: RowsBannerProps) {
  const { loading, paged, loadMore, loadAll, dialog } = useLoadRows(load);
  return (
    <>
      <Alert
        type="info"
        showIcon
        className={styles.banner}
        title={`First ${rows.loaded.toLocaleString()} rows — there may be more.`}
        action={
          load && (
            <Space size="small">
              <Button size="small" loading={loading === 'more'} disabled={loading !== null} onClick={loadMore}>
                Load {rows.step.toLocaleString()} more
              </Button>
              <Button size="small" loading={loading === 'all'} disabled={loading !== null} onClick={loadAll}>
                Load all
              </Button>
            </Space>
          )
        }
      />
      <LoadAllDialog {...dialog} loaded={rows.loaded} paged={paged} />
    </>
  );
}

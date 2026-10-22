import { useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from 'antd';
import { useDashboards } from '../../entities/dashboard';
import { parseDashboardSplat } from '../../navigation/millerPath';
import { buildColumns, resolveRoot, reuseColumns, type ColumnConfig } from './model';
import { MillerListView } from './MillerListView';
import styles from './MillerColumn.module.css';

/**
 * A dashboard and the columns opened from it: `/` is the Concepts dashboard,
 * `/d/<dashboard>/<column>/…` any dashboard (a concept, a saved one, the
 * graph) followed by the Miller columns its links opened.
 */
export function MillerListPage() {
  const splat = useParams<{ '*': string }>()['*'] ?? '';
  const { find } = useDashboards();
  const { root, rootSegment, stack } = useMemo(() => parseDashboardSplat(splat), [splat]);
  const rootColumn = useMemo(() => resolveRoot(root, find), [root, find]);
  // Unchanged columns keep their object, so their memoised components skip the render.
  const previous = useRef<ColumnConfig[]>([]);
  const columns = useMemo(() => {
    const next = rootColumn ? buildColumns(rootSegment, rootColumn, stack) : [];
    previous.current = reuseColumns(previous.current, next);
    return previous.current;
  }, [rootSegment, rootColumn, stack]);

  if (!rootColumn) {
    return <Alert type="warning" showIcon title="This dashboard no longer exists" />;
  }

  return (
    <div className={styles.page}>
      <MillerListView columns={columns} />
    </div>
  );
}

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from 'antd';
import { parseMillerPath } from './model';
import { MillerListView } from './MillerListView';
import styles from './MillerColumn.module.css';

/**
 * Split-view columnar navigation: /miller/:rootConcept or
 * /miller/:rootConcept/:concept/:itemId/… shows the root concept's work list
 * then each drilled-in entity side by side. Each column owns its own
 * perspectives (views) and AI editing, and introspects its concept on demand.
 */
export function MillerListPage() {
  const splat = useParams<{ '*': string }>()['*'] ?? '';
  const { root, stack } = useMemo(() => parseMillerPath(splat), [splat]);

  if (!root) {
    return <Alert type="warning" showIcon title="No concept selected" />;
  }

  return (
    <div className={styles.page}>
      <MillerListView rootConceptName={root} navigationStack={stack} />
    </div>
  );
}

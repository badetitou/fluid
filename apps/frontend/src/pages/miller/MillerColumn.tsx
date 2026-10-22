import { memo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useConcept } from '../../entities/concept';
import { MillerColumnPathContext } from '../../navigation/columnPath';
import { MillerColumnBody, type ColumnMode } from './MillerColumnBody';
import type { ColumnConfig } from './model';
import styles from './MillerColumn.module.css';

interface MillerColumnProps {
  column: ColumnConfig;
  mode: ColumnMode;
  onToggleFullscreen: (slot: string) => void;
  onClose: (parentPath: string) => void;
}

/**
 * A column bound to one concept. It introspects the concept's type on demand,
 * then hands over to the column body.
 */
export const MillerColumn = memo(function MillerColumn({ column, mode, onToggleFullscreen, onClose }: MillerColumnProps) {
  const { conceptName, path } = column;
  const { concept, fetching, error } = useConcept(conceptName);

  if (error || concept === null || (!fetching && !concept)) {
    return (
      <div className={styles.padded}>
        <Alert
          type={error ? 'error' : 'warning'}
          showIcon
          title={error ? `Could not introspect ${conceptName}` : 'Unknown concept'}
          description={error ? error.message : `No object type named "${conceptName}" exists.`}
        />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className={styles.padded}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <MillerColumnPathContext.Provider value={path}>
      <MillerColumnBody concept={concept} column={column} mode={mode} onToggleFullscreen={onToggleFullscreen} onClose={onClose} />
    </MillerColumnPathContext.Provider>
  );
});

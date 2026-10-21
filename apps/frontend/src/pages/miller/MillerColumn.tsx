import { memo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useConcept } from '../../entities/concept';
import { MillerColumnPathContext } from '../../navigation/columnPath';
import { MillerColumnBody, type ColumnFrame } from './MillerColumnBody';
import styles from './MillerColumn.module.css';

interface MillerColumnProps extends ColumnFrame {
  conceptName: string;
  /** Miller path of this column; links inside it open the next column after it. */
  path: string;
}

/**
 * A single Miller navigation column bound to one concept. It introspects the
 * concept's type on demand, then hands over to the column body.
 */
export const MillerColumn = memo(function MillerColumn({ conceptName, path, ...frame }: MillerColumnProps) {
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
      <MillerColumnBody concept={concept} path={path} {...frame} />
    </MillerColumnPathContext.Provider>
  );
});

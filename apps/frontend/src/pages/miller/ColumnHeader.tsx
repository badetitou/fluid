import type { ReactNode } from 'react';
import { Flex, Tooltip, Typography } from 'antd';
import { usePreferences } from '../../store';
import styles from './MillerColumn.module.css';

interface ColumnHeaderProps {
  title: string;
  subtitle: string;
  /** Perspective pills (or the layout hint while arranging widgets). */
  bar: ReactNode;
  actions: ReactNode;
}

/**
 * Header of a Miller column. Compact density folds title, perspectives and
 * actions into a single row; the subtitle then moves to a tooltip on the title.
 */
export function ColumnHeader({ title, subtitle, bar, actions }: ColumnHeaderProps) {
  const compact = usePreferences((s) => s.density === 'compact');

  if (compact) {
    return (
      <div className={`${styles.header} ${styles.compactHeader}`}>
        <Tooltip title={subtitle} mouseEnterDelay={0.6}>
          <Typography.Text strong ellipsis className={styles.compactTitle}>
            {title}
          </Typography.Text>
        </Tooltip>
        {bar || <div className={styles.spacer} />}
        {actions}
      </div>
    );
  }

  return (
    <div className={styles.header}>
      <Flex align="flex-start" justify="space-between" gap={8}>
        <div className={styles.titleBlock}>
          <div className={styles.subtitle}>{subtitle}</div>
          <Typography.Text strong ellipsis className={styles.title}>
            {title}
          </Typography.Text>
        </div>
        {actions}
      </Flex>
      {bar}
    </div>
  );
}

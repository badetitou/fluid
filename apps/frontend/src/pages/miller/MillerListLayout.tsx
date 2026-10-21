import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Empty, Flex } from 'antd';
import { ErrorBoundary } from '../../shared/ui';
import { ColumnPager } from './ColumnPager';
import styles from './MillerListLayout.module.css';

interface MillerListLayoutProps {
  /** One node per navigation level. Each already renders its own header + body. */
  children: ReactNode;
  /** Number of consecutive columns shown at once. */
  visibleCount?: number;
  /** Optional label per column, shown as a tooltip on the pager. */
  labels?: string[];
}

/**
 * Lays out Miller navigation columns side by side, showing a sliding window of
 * `visibleCount` consecutive columns (two by default). When navigation opens a
 * new column the window follows it, so the last two levels are always on screen.
 *
 * Columns outside the window stay mounted (just hidden) so their local state —
 * selected perspective, pagination — survives scrolling back. Each column is
 * wrapped in an error boundary so a single failing perspective cannot blank the screen.
 */
export function MillerListLayout({ children, visibleCount = 2, labels }: MillerListLayoutProps) {
  const columns = Children.toArray(children);
  const count = columns.length;
  const windowSize = Math.max(1, Math.min(visibleCount, count));
  const maxStart = Math.max(0, count - windowSize);

  const [start, setStart] = useState(maxStart);
  const [prevCount, setPrevCount] = useState(count);
  // Follow navigation: when columns are added, slide to show the newest ones.
  if (count !== prevCount) {
    setPrevCount(count);
    if (count > prevCount) setStart(maxStart);
  }
  const first = Math.min(start, maxStart);
  const last = first + windowSize - 1;

  if (count === 0) {
    return (
      <Flex align="center" justify="center" className={styles.root}>
        <Empty description="Nothing to show" />
      </Flex>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.columns}>
        {columns.map((column, index) => (
          <div
            key={isValidElement(column) && column.key != null ? column.key : index}
            className={[
              styles.column,
              index < last && styles.divided,
              (index < first || index > last) && styles.hidden,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <ErrorBoundary>{column}</ErrorBoundary>
          </div>
        ))}
      </div>

      {count > windowSize && (
        <ColumnPager count={count} first={first} last={last} labels={labels} onStartChange={setStart} />
      )}
    </div>
  );
}

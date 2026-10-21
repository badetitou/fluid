import { Button, Tooltip } from 'antd';
import { LeftOutlined, MinusOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { growWindow, shrinkWindow, type ColumnWindow } from './columnWindow';
import { PagerWindow } from './PagerWindow';
import styles from './MillerListLayout.module.css';

interface ColumnPagerProps {
  count: number;
  /** Index of the first and last visible columns. */
  first: number;
  last: number;
  labels?: string[];
  /** Moves the window so it starts at the given column. */
  onStartChange: (start: number) => void;
  /** Shows another range of columns: the −/+ buttons, or dragging the frame's edges. */
  onResize: (window: ColumnWindow) => void;
}

/**
 * A small pager in the spirit of the Pharo/GT inspector: one box per column,
 * the visible ones highlighted, a click jumps to any level. The −/+ buttons,
 * or dragging the edges of the frame around the highlighted boxes, show more
 * or fewer columns side by side.
 */
export function ColumnPager({ count, first, last, labels, onStartChange, onResize }: ColumnPagerProps) {
  const size = last - first + 1;
  /** Slides the window the minimum amount needed to bring `index` into view. */
  const reveal = (index: number) => {
    if (index < first) onStartChange(index);
    else if (index > last) onStartChange(index - size + 1);
  };

  return (
    <div className={styles.pager}>
      <Tooltip title="Show fewer columns">
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          disabled={size === 1}
          onClick={() => onResize(shrinkWindow({ first, last }, count))}
          aria-label="Show fewer columns"
        />
      </Tooltip>
      <Button
        type="text"
        size="small"
        icon={<LeftOutlined />}
        disabled={first === 0}
        onClick={() => onStartChange(first - 1)}
        aria-label="Previous column"
      />
      <div className={styles.boxes}>
        {Array.from({ length: count }, (_, index) => {
          const shown = index >= first && index <= last;
          return (
            <Tooltip key={index} title={labels?.[index]} mouseEnterDelay={0.4}>
              <button
                type="button"
                aria-label={labels?.[index] ?? `Column ${index + 1}`}
                aria-current={shown}
                onClick={() => reveal(index)}
                className={`${styles.box} ${shown ? styles.shown : ''}`}
              />
            </Tooltip>
          );
        })}
        <PagerWindow range={{ first, last }} count={count} onResize={onResize} />
      </div>
      <Button
        type="text"
        size="small"
        icon={<RightOutlined />}
        disabled={last === count - 1}
        onClick={() => onStartChange(first + 1)}
        aria-label="Next column"
      />
      <Tooltip title="Show more columns">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          disabled={size === count}
          onClick={() => onResize(growWindow({ first, last }, count))}
          aria-label="Show more columns"
        />
      </Tooltip>
    </div>
  );
}

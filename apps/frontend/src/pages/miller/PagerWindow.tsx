import { PAGER_GAP_PX, PAGER_STEP_PX, type ColumnWindow, type WindowEdge } from './columnWindow';
import { useWindowResize } from './useWindowResize';
import styles from './MillerListLayout.module.css';

interface PagerWindowProps {
  range: ColumnWindow;
  count: number;
  /** Shows another range of columns, possibly wider or narrower. */
  onResize: (window: ColumnWindow) => void;
}

const EDGES: { edge: WindowEdge; label: string }[] = [
  { edge: 'start', label: 'Show columns on the left' },
  { edge: 'end', label: 'Show columns on the right' },
];

/**
 * A frame over the pager's highlighted boxes whose two edges can be dragged,
 * like a range slider, to choose how many columns are shown side by side.
 */
export function PagerWindow({ range, count, onResize }: PagerWindowProps) {
  const { dragging, onPointerDown, onKeyDown, onReset } = useWindowResize(range, count, onResize);
  const size = range.last - range.first + 1;

  return (
    <div
      className={styles.window}
      style={{ left: range.first * PAGER_STEP_PX, width: size * PAGER_STEP_PX - PAGER_GAP_PX }}
    >
      {EDGES.map(({ edge, label }) => (
        <div
          key={edge}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={label}
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={size}
          title="Drag to show more or fewer columns, double-click to reset"
          className={`${styles.grip} ${edge === 'start' ? styles.gripStart : styles.gripEnd} ${dragging === edge ? styles.gripActive : ''}`}
          onPointerDown={(e) => onPointerDown(edge, e)}
          onKeyDown={(e) => onKeyDown(edge, e)}
          onDoubleClick={onReset}
        />
      ))}
    </div>
  );
}

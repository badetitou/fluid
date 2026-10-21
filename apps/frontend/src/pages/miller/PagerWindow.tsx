import { PAGER_GAP_PX, frameOf, type ColumnWindow, type WindowDrag } from './columnWindow';
import { useWindowDrag } from './useWindowDrag';
import styles from './MillerListLayout.module.css';

interface PagerWindowProps {
  range: ColumnWindow;
  count: number;
  /** Shows another range of columns, possibly wider or narrower. */
  onResize: (window: ColumnWindow) => void;
}

const EDGES: { drag: WindowDrag; className: string }[] = [
  { drag: 'start', className: styles.edgeStart },
  { drag: 'end', className: styles.edgeEnd },
];

/**
 * An overlay over the pager's highlighted boxes: drag it to choose which
 * columns are shown, or drag one of its edges to show more or fewer of them.
 * It follows the pointer while dragged and snaps onto the boxes on release.
 */
export function PagerWindow({ range, count, onResize }: PagerWindowProps) {
  const { dragging, onPointerDown, onKeyDown, onReset } = useWindowDrag(range, count, onResize);
  const { left, right } = dragging?.frame ?? frameOf(range);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Shown columns"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={range.first + 1}
      aria-valuetext={`Columns ${range.first + 1} to ${range.last + 1} of ${count}`}
      title="Drag to choose the columns, drag an edge to show more or fewer, double-click to reset"
      className={`${styles.window} ${dragging ? styles.windowDragging : ''}`}
      style={{ left, width: right - left - PAGER_GAP_PX }}
      onPointerDown={(e) => onPointerDown('move', e)}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
    >
      {EDGES.map(({ drag, className }) => (
        <div
          key={drag}
          aria-hidden
          className={`${styles.edge} ${className}`}
          onPointerDown={(e) => onPointerDown(drag, e)}
        />
      ))}
    </div>
  );
}

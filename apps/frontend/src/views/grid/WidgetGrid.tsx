import { useMemo, type ReactNode } from 'react';
import { GRID_COLUMNS, type Widget } from '@fluid/shared';
import { useElementWidth } from '../../hooks/useElementWidth';
import { GRID_GAP, ROW_HEIGHT, cellsToPx, gridRows, resolveLayout, type Box } from '../gridLayout';
import { GridItem } from './GridItem';
import { useGridDrag, type Drag } from './useGridDrag';
import styles from './WidgetGrid.module.css';

interface WidgetGridProps {
  widgets: Widget[];
  /** Renders one widget's card; it should fill the cell it is given. */
  renderWidget: (widget: Widget) => ReactNode;
  /** Edit mode: widgets can be dragged, resized and removed. */
  editing?: boolean;
  /** Called with the widgets, each carrying its new `layout`, after every edit. */
  onChange?: (widgets: Widget[]) => void;
  /** Narrow container: stack widgets full-width, in reading order (view mode only). */
  stacked?: boolean;
}

/** Extra empty rows shown below the widgets in edit mode, to drop things into. */
const SPARE_ROWS = 3;

/** Pixel rectangle of a box, or of the dragged box following the pointer. */
function rectFor(box: Box, colWidth: number, drag: Drag | null) {
  const stepX = colWidth + GRID_GAP;
  const stepY = ROW_HEIGHT + GRID_GAP;
  const at = (b: Box) => ({
    left: b.x * stepX,
    top: b.y * stepY,
    width: cellsToPx(b.w, colWidth),
    height: cellsToPx(b.h, ROW_HEIGHT),
  });
  if (drag?.id !== box.id) return at(drag?.preview.find((b) => b.id === box.id) ?? box);
  const start = at(drag.start);
  return drag.mode === 'move'
    ? { ...start, left: start.left + drag.dx, top: start.top + drag.dy }
    : {
        ...start,
        width: Math.max(colWidth, start.width + drag.dx),
        height: Math.max(ROW_HEIGHT, start.height + drag.dy),
      };
}

/**
 * Lays widgets out on the view's grid. In edit mode it works like widgets on a
 * macOS desktop: drag a widget to move it, drag its corner to resize it, the
 * "−" badge removes it and a right-click offers preset sizes. Widgets snap to
 * cells and never overlap; whatever is in the way moves aside.
 */
export function WidgetGrid({ widgets, renderWidget, editing = false, onChange, stacked }: WidgetGridProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const boxes = useMemo(() => resolveLayout(widgets), [widgets]);
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const colWidth = Math.max(0, (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const { drag, startDrag, onKeyDown, remove, resize } = useGridDrag({ widgets, boxes, colWidth, editing, onChange });

  if (stacked && !editing) {
    const ordered = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div ref={containerRef} className={styles.stacked}>
        {ordered.map((b) => (
          <div key={b.id} style={{ height: cellsToPx(b.h, ROW_HEIGHT) }}>
            {renderWidget(byId.get(b.id)!)}
          </div>
        ))}
      </div>
    );
  }

  const shown = drag?.preview ?? boxes;
  const rows = gridRows(shown) + (editing ? SPARE_ROWS : 0);
  const landing = drag && shown.find((b) => b.id === drag.id);
  const step = `${colWidth + GRID_GAP}px ${ROW_HEIGHT + GRID_GAP}px`;
  const className = [styles.grid, drag && styles.dragging, editing && colWidth > 0 && styles.dotted]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: cellsToPx(rows, ROW_HEIGHT),
        backgroundSize: step,
        backgroundPosition: `${-GRID_GAP / 2}px ${-GRID_GAP / 2}px`,
      }}
    >
      {/* Where the dragged widget will land. */}
      {landing && <div className={styles.placeholder} style={rectFor(landing, colWidth, null)} />}

      {colWidth > 0 &&
        boxes.map((box) => {
          const widget = byId.get(box.id)!;
          return (
            <GridItem
              key={box.id}
              label={widget.title ?? widget.type}
              rect={rectFor(box, colWidth, drag)}
              editing={
                editing
                  ? {
                      dragMode: drag?.id === box.id ? drag.mode : undefined,
                      onPointerDown: (e, mode) => startDrag(e, box, mode),
                      onKeyDown: (e) => onKeyDown(e, box),
                      onRemove: () => remove(box.id),
                      onResize: (w, h) => resize(box, w, h),
                    }
                  : undefined
              }
            >
              {renderWidget(widget)}
            </GridItem>
          );
        })}
    </div>
  );
}

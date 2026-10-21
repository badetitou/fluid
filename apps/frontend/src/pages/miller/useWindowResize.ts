import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  DEFAULT_VISIBLE_COLUMNS,
  dragSteps,
  resizeWindow,
  type ColumnWindow,
  type WindowEdge,
} from './columnWindow';

/**
 * Drag-to-resize for the pager's window: each edge grip moves by whole
 * columns while dragged, or with the arrow keys once focused. Double-clicking
 * a grip goes back to the default number of columns.
 */
export function useWindowResize(
  { first, last }: ColumnWindow,
  count: number,
  onResize: (window: ColumnWindow) => void,
) {
  const [dragging, setDragging] = useState<WindowEdge | null>(null);

  const onPointerDown = useCallback(
    (edge: WindowEdge, e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const startX = e.clientX;
      let steps = 0;
      handle.setPointerCapture(e.pointerId);
      setDragging(edge);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const onMove = (move: globalThis.PointerEvent) => {
        const next = dragSteps(move.clientX - startX);
        if (next === steps) return;
        steps = next;
        onResize(resizeWindow({ first, last }, count, edge, steps));
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDragging(null);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    },
    [first, last, count, onResize],
  );

  const onKeyDown = useCallback(
    (edge: WindowEdge, e: KeyboardEvent<HTMLElement>) => {
      const steps = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!steps) return;
      e.preventDefault();
      onResize(resizeWindow({ first, last }, count, edge, steps));
    },
    [first, last, count, onResize],
  );

  const onReset = useCallback(
    () => onResize(resizeWindow({ first, last: first }, count, 'end', DEFAULT_VISIBLE_COLUMNS - 1)),
    [first, count, onResize],
  );

  return { dragging, onPointerDown, onKeyDown, onReset };
}

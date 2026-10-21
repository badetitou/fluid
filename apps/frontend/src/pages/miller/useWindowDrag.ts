import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  DEFAULT_VISIBLE_COLUMNS,
  dragWindow,
  moveWindow,
  resizeWindow,
  type ColumnWindow,
  type WindowDrag,
  type WindowFrame,
} from './columnWindow';

/**
 * Pointer and keyboard handling for the pager's overlay. While dragged, the
 * overlay follows the pointer (`frame`) and the shown columns change as soon
 * as it gets nearer other boxes; on release it snaps back onto the boxes.
 * Arrows slide the window, Shift+arrows resize it, double-click resets it.
 */
export function useWindowDrag(
  { first, last }: ColumnWindow,
  count: number,
  onResize: (window: ColumnWindow) => void,
) {
  const [dragging, setDragging] = useState<{ drag: WindowDrag; frame: WindowFrame } | null>(null);

  const onPointerDown = useCallback(
    (drag: WindowDrag, e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      const startX = e.clientX;
      let current: ColumnWindow = { first, last };
      handle.setPointerCapture(e.pointerId);
      document.body.style.cursor = drag === 'move' ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';

      const onMove = (move: globalThis.PointerEvent) => {
        const next = dragWindow({ first, last }, count, drag, move.clientX - startX);
        setDragging({ drag, frame: next.frame });
        if (next.window.first !== current.first || next.window.last !== current.last) {
          current = next.window;
          onResize(current);
        }
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
    (e: KeyboardEvent<HTMLElement>) => {
      const steps = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!steps) return;
      e.preventDefault();
      const window = { first, last };
      onResize(e.shiftKey ? resizeWindow(window, count, 'end', steps) : moveWindow(window, count, steps));
    },
    [first, last, count, onResize],
  );

  // Back to the default size, keeping the deepest column on screen.
  const onReset = useCallback(
    () => onResize(resizeWindow({ first: last, last }, count, 'start', 1 - DEFAULT_VISIBLE_COLUMNS)),
    [last, count, onResize],
  );

  return { dragging, onPointerDown, onKeyDown, onReset };
}

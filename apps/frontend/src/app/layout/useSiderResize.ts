import { useCallback, useState, type PointerEvent } from 'react';
import { usePreferences } from '../../store';
import { siderWidthAfterDrag } from './model';

/**
 * Drag-to-resize for the navbar: returns the pointer handler for its edge
 * handle and whether a drag is in progress. The width is remembered in the
 * preferences; double-clicking the handle restores the density default.
 */
export function useSiderResize(currentWidth: number) {
  const side = usePreferences((s) => s.navbarSide);
  const setWidth = usePreferences((s) => s.setNavbarWidth);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const startX = e.clientX;
      handle.setPointerCapture(e.pointerId);
      setDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (move: globalThis.PointerEvent) =>
        setWidth(siderWidthAfterDrag(currentWidth, move.clientX - startX, side));
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDragging(false);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    },
    [currentWidth, setWidth, side],
  );

  const onDoubleClick = useCallback(() => setWidth(null), [setWidth]);

  return { dragging, onPointerDown, onDoubleClick };
}

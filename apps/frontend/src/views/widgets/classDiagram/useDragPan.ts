import { useMemo, useRef, type PointerEvent } from 'react';

interface Drag {
  x: number;
  y: number;
  left: number;
  top: number;
}

/** Pointer handlers panning a scrollable element when its background is dragged (buttons still click). */
export function useDragPan() {
  const drag = useRef<Drag | null>(null);
  return useMemo(
    () => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button, a'))) return;
        const el = e.currentTarget;
        drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
        el.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const start = drag.current;
        if (!start) return;
        e.currentTarget.scrollLeft = start.left - (e.clientX - start.x);
        e.currentTarget.scrollTop = start.top - (e.clientY - start.y);
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    }),
    [],
  );
}

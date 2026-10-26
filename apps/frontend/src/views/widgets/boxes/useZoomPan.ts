import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface ZoomPan {
  transform: Transform;
  /** Callback ref of the element listening to the wheel (a non-passive listener, to stop the page scrolling). */
  wheelRef: (el: Element | null) => void;
  handlers: {
    onPointerDown: (e: PointerEvent<Element>) => void;
    onPointerMove: (e: PointerEvent<Element>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  /** Whether the last press moved the view: its click is not a click on a box. */
  dragged: () => boolean;
  zoomBy: (factor: number) => void;
  fit: () => void;
}

const MIN_K = 0.05;
const MAX_K = 8;
const DRAG_THRESHOLD = 3;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

/** The initial view: the whole drawing when it fits at most 1:1, else its width (scroll down by dragging). */
export function initialTransform(content: { width: number; height: number }, view: { width: number; height: number }): Transform {
  if (content.width <= 0 || view.width <= 0) return { x: 0, y: 0, k: 1 };
  return { x: 0, y: 0, k: clampK(Math.min(1, view.width / content.width)) };
}

/** The view fitting the whole drawing. */
export function fitTransform(content: { width: number; height: number }, view: { width: number; height: number }): Transform {
  if (content.width <= 0 || content.height <= 0) return { x: 0, y: 0, k: 1 };
  const k = clampK(Math.min(1, view.width / content.width, view.height / content.height));
  return { x: (view.width - content.width * k) / 2, y: (view.height - content.height * k) / 2, k };
}

/** Zoom (wheel, buttons) and pan (drag) of an SVG drawing of `content` size shown in a `view`-sized frame. */
export function useZoomPan(content: { width: number; height: number }, view: { width: number; height: number }): ZoomPan {
  const [state, setState] = useState(() => ({ content, transform: initialTransform(content, view) }));
  /** The press being dragged: where it started, and where the view was last moved from. */
  const drag = useRef<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [el, setEl] = useState<Element | null>(null);

  // A new drawing (other data, other width): back to the initial view.
  if (state.content.width !== content.width || state.content.height !== content.height) {
    setState({ content, transform: initialTransform(content, view) });
  }

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setState((s) => {
      const { x, y, k } = s.transform;
      const next = clampK(k * factor);
      return { ...s, transform: { k: next, x: px - ((px - x) * next) / k, y: py - ((py - y) * next) / k } };
    });
  }, []);

  useEffect(() => {
    if (!el) return;
    const onWheel = (e: Event) => {
      if (!(e instanceof WheelEvent)) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [el, zoomAt]);

  const handlers = useMemo(
    () => ({
      onPointerDown: (e: PointerEvent<Element>) => {
        if (e.button !== 0) return;
        moved.current = false;
        drag.current = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      },
      onPointerMove: (e: PointerEvent<Element>) => {
        const at = drag.current;
        if (!at) return;
        if (!moved.current && Math.hypot(e.clientX - at.x0, e.clientY - at.y0) < DRAG_THRESHOLD) return;
        if (!moved.current) e.currentTarget.setPointerCapture?.(e.pointerId);
        moved.current = true;
        const dx = e.clientX - at.x;
        const dy = e.clientY - at.y;
        at.x = e.clientX;
        at.y = e.clientY;
        setState((s) => ({ ...s, transform: { ...s.transform, x: s.transform.x + dx, y: s.transform.y + dy } }));
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

  const zoomBy = useCallback((factor: number) => zoomAt(factor, view.width / 2, view.height / 2), [zoomAt, view.width, view.height]);
  const fit = useCallback(() => setState((s) => ({ ...s, transform: fitTransform(s.content, view) })), [view]);
  const dragged = useCallback(() => moved.current, []);

  return { transform: state.transform, wheelRef: setEl, handlers, dragged, zoomBy, fit };
}

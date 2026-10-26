import { useEffect, useRef } from 'react';
import { BOX, type DiagramLayout } from './classLayout';

const TOP_ROOM = 24;
/** Narrower than this, the viewport is not laid out yet. */
const MIN_OPEN_WIDTH = 120;

/** Scroll position centring a box horizontally, its top just below the viewport's. */
export function scrollToBox(box: { x: number; y: number }, viewportWidth: number): { left: number; top: number } {
  return { left: Math.max(0, box.x + BOX.width / 2 - viewportWidth / 2), top: Math.max(0, box.y - TOP_ROOM) };
}

/**
 * A ref for the scrollable viewport. It opens on the first root (centred: in a
 * wide hierarchy the root sits above the middle of its subclasses, far from the
 * left edge), then is scrolled once to bring each new `target` into view.
 */
export function useScrollToClass(layout: DiagramLayout, target: { key: string; seq: number } | undefined) {
  const viewport = useRef<HTMLDivElement>(null);
  const done = useRef(0);
  const opened = useRef(false);
  useEffect(() => {
    const el = viewport.current;
    const root = layout.boxes[0];
    if (!el || opened.current || !root) return;
    // The column may still be growing in (its opening animation): wait for a real width.
    const open = () => {
      if (opened.current || el.clientWidth < MIN_OPEN_WIDTH) return false;
      opened.current = true;
      el.scrollTo?.(scrollToBox(root, el.clientWidth));
      return true;
    };
    if (open() || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => open() && observer.disconnect());
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout]);
  useEffect(() => {
    const el = viewport.current;
    const box = target && target.seq !== done.current ? layout.boxes.find((b) => b.key === target.key) : undefined;
    if (!el || !box || !target) return;
    done.current = target.seq;
    el.scrollTo?.({ ...scrollToBox(box, el.clientWidth), behavior: 'smooth' });
  }, [layout, target]);
  return viewport;
}

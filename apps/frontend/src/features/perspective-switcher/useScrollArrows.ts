import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { overflowEdges, scrollStep, type OverflowEdges } from './model';

export interface ScrollArrows {
  ref: RefObject<HTMLDivElement | null>;
  edges: OverflowEdges;
  scroll: (direction: -1 | 1) => void;
}

/**
 * Horizontal scroller without a visible scrollbar: tells which arrows to show,
 * scrolls by a step on click and maps the vertical mouse wheel to horizontal.
 */
export function useScrollArrows(): ScrollArrows {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<OverflowEdges>({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges((prev) => {
        const next = overflowEdges(el);
        return prev.left === next.left && prev.right === next.right ? prev : next;
      });
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(el);
    // Pills added or renamed change the content width without resizing the bar.
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      resize.disconnect();
      mutations.disconnect();
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const scroll = useCallback((direction: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * scrollStep(el.clientWidth), behavior: 'smooth' });
  }, []);

  return { ref, edges, scroll };
}

import { useEffect, useRef } from 'react';
import { BOX, type DiagramLayout } from './classLayout';

const TOP_ROOM = 24;

/** A ref for the scrollable viewport, scrolled once to bring each new `target` into view. */
export function useScrollToClass(layout: DiagramLayout, target: { key: string; seq: number } | undefined) {
  const viewport = useRef<HTMLDivElement>(null);
  const done = useRef(0);
  useEffect(() => {
    const el = viewport.current;
    const box = target && target.seq !== done.current ? layout.boxes.find((b) => b.key === target.key) : undefined;
    if (!el || !box || !target) return;
    done.current = target.seq;
    el.scrollTo?.({
      left: Math.max(0, box.x + BOX.width / 2 - el.clientWidth / 2),
      top: Math.max(0, box.y - TOP_ROOM),
      behavior: 'smooth',
    });
  }, [layout, target]);
  return viewport;
}

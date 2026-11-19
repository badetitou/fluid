import { useEffect, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/** Whether the host needs to hear about a new size (whole pixels; the first one always). */
export function sizeChanged(prev: Size | undefined, next: Size): boolean {
  return !prev || prev.width !== next.width || prev.height !== next.height;
}

/**
 * Reports the size of the element it is attached to (callback ref) through `report`, on every change.
 * A new `report` (the host connection came up) hears the current size again.
 */
export function useReportSize(report: (size: Size) => void): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!el) return;
    let last: Size | undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
      if (!sizeChanged(last, next)) return;
      last = next;
      report(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [el, report]);

  return setEl;
}

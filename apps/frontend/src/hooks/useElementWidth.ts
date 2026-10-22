import { useLayoutEffect, useState } from 'react';

type Dimension = 'width' | 'height';

// Returns a callback ref (not a ref object) so that the size follows whichever
// element currently carries it: a component that swaps the measured element
// (a loading skeleton, then the content) keeps measuring the live one instead
// of the detached first one, which ResizeObserver reports as 0 wide.
function useElementSize<T extends HTMLElement>(dimension: Dimension) {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState(0);

  useLayoutEffect(() => {
    if (!el) return;
    setSize(el.getBoundingClientRect()[dimension]);
    const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect[dimension]));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, dimension]);

  return [setEl, size] as const;
}

/** Tracks the rendered width of an element, updating whenever it is resized. */
export function useElementWidth<T extends HTMLElement>() {
  return useElementSize<T>('width');
}

/** Tracks the rendered height of an element, updating whenever it is resized. */
export function useElementHeight<T extends HTMLElement>() {
  return useElementSize<T>('height');
}

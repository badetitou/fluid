import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useElementWidth } from './useElementWidth';

type Report = (entries: { contentRect: { width: number } }[]) => void;

// Elements under observation, with the callback of the observer watching each.
const watched = new Map<Element, Report>();

beforeEach(() => {
  watched.clear();
  globalThis.ResizeObserver = class {
    private targets: Element[] = [];
    constructor(private report: Report) {}
    observe(el: Element) {
      this.targets.push(el);
      watched.set(el, this.report);
    }
    unobserve() {}
    disconnect() {
      for (const el of this.targets) watched.delete(el);
    }
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200 } as DOMRect);
});

afterEach(() => vi.restoreAllMocks());

let finishLoading = () => {};

function Swapping() {
  const [loading, setLoading] = useState(true);
  const [ref, width] = useElementWidth<HTMLElement>();
  finishLoading = () => setLoading(false);
  // Different tags, so React mounts a new element rather than reusing the first.
  return loading ? <section ref={ref}>loading</section> : <div ref={ref} data-testid="content">{width}</div>;
}

it('measures the element that replaces the first one carrying the ref', () => {
  const { getByTestId } = render(<Swapping />);
  act(() => finishLoading());
  // Like a browser: elements still observed but no longer in the page are reported 0 wide.
  act(() => {
    for (const [el, report] of watched) if (!el.isConnected) report([{ contentRect: { width: 0 } }]);
  });
  const content = getByTestId('content');
  expect(watched.has(content)).toBe(true);
  expect(content.textContent).toBe('1200');
});

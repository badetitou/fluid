import { describe, expect, it } from 'vitest';
import { overflowEdges, scrollStep } from './model';

describe('overflowEdges', () => {
  it('shows no arrow when everything fits', () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 200, clientWidth: 200 })).toEqual({ left: false, right: false });
  });

  it('shows only the right arrow at the start', () => {
    expect(overflowEdges({ scrollLeft: 0, scrollWidth: 400, clientWidth: 200 })).toEqual({ left: false, right: true });
  });

  it('shows both arrows in the middle', () => {
    expect(overflowEdges({ scrollLeft: 100, scrollWidth: 400, clientWidth: 200 })).toEqual({ left: true, right: true });
  });

  it('ignores sub-pixel leftovers at the end', () => {
    expect(overflowEdges({ scrollLeft: 199.5, scrollWidth: 400, clientWidth: 200 })).toEqual({ left: true, right: false });
  });
});

describe('scrollStep', () => {
  it('scrolls most of the visible width', () => {
    expect(scrollStep(200)).toBe(140);
  });

  it('never scrolls less than a pill', () => {
    expect(scrollStep(20)).toBe(40);
  });
});

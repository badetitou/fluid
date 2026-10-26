import { describe, expect, it } from 'vitest';
import { fitTransform, initialTransform, READABLE_K } from './useZoomPan';

const view = { width: 800, height: 400 };

describe('boxes initial view', () => {
  it('shows the whole width when it fits at a readable scale', () => {
    expect(initialTransform({ width: 400, height: 900 }, view)).toEqual({ x: 0, y: 0, k: 1 });
    expect(initialTransform({ width: 1600, height: 300 }, view)).toEqual({ x: 0, y: 0, k: 0.5 });
  });

  it('keeps a wide hierarchy readable, centred on its top', () => {
    const t = initialTransform({ width: 20000, height: 300 }, view);
    expect(t.k).toBe(READABLE_K);
    expect(t.y).toBe(0);
    expect(t.x).toBeCloseTo(-(20000 * READABLE_K - 800) / 2);
  });

  it('fit still shows everything', () => {
    expect(fitTransform({ width: 8000, height: 300 }, view).k).toBeCloseTo(800 / 8000);
  });
});

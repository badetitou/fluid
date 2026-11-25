import { describe, expect, it } from 'vitest';
import { fittedRatio, normalizedCenter, type Extent } from './cameraModel';
import type { Bounds } from './hierarchyModel';

const extent: Extent = { x: [97, 737], y: [71, 12767] };

describe('explorer camera', () => {
  it('centers the camera in sigma normalized space, not in graph units', () => {
    const bounds: Bounds = { minX: 97, minY: 71, maxX: 737, maxY: 12767 };
    expect(normalizedCenter(extent, bounds)).toEqual({ x: 0.5, y: 0.5 });

    const small: Bounds = { minX: 0, minY: 0, maxX: 562, maxY: 142 };
    const center = normalizedCenter({ x: [0, 562], y: [0, 142] }, small);
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo(0.5);
  });

  it('zooms out when the graph is too large and in when it is too small', () => {
    const bounds: Bounds = { minX: 97, minY: 71, maxX: 737, maxY: 12767 };
    const zoomedIn = fittedRatio(1, 1, bounds, 1004, 676);
    expect(zoomedIn).toBeGreaterThan(1);
    const zoomedOut = fittedRatio(zoomedIn, 0.01, bounds, 1004, 676);
    expect(zoomedOut).toBeLessThan(zoomedIn);

    const fitted = fittedRatio(1, 0.0465, bounds, 1004, 676);
    expect(fitted).toBeGreaterThan(0.9);
    expect(fitted).toBeLessThan(1.1);
  });

  it('keeps an invalid scale unchanged', () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(fittedRatio(2, 0, bounds, 100, 100)).toBe(2);
    expect(fittedRatio(2, Number.NaN, bounds, 100, 100)).toBe(2);
  });
});

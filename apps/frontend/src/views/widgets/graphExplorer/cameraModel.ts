import type { Bounds } from './hierarchyModel';

export interface Extent {
  x: [number, number];
  y: [number, number];
}

const MIN_RATIO = 0.001;
const MAX_RATIO = 1000;
/** Leave a little room around the hierarchy so its outer boxes stay readable. */
const FIT_MARGIN = 0.88;

/**
 * Sigma normalizes the graph into a unit square centered on (0.5, 0.5): its
 * camera x/y are expressed in that normalized space, never in graph units.
 * Passing graph coordinates there puts the whole hierarchy offscreen.
 */
export function normalizedCenter(extent: Extent, bounds: Bounds): { x: number; y: number } {
  const span = Math.max(1, extent.x[1] - extent.x[0], extent.y[1] - extent.y[0]);
  const centerX = (extent.x[0] + extent.x[1]) / 2;
  const centerY = (extent.y[0] + extent.y[1]) / 2;
  return {
    x: 0.5 + ((bounds.minX + bounds.maxX) / 2 - centerX) / span,
    y: 0.5 + ((bounds.minY + bounds.maxY) / 2 - centerY) / span,
  };
}

/**
 * The camera ratio is a zoom-out factor: sigma's pixels-per-graph-unit scale is
 * inversely proportional to it. Zooming out therefore means multiplying the
 * current ratio by currentScale / desiredScale, not the other way around.
 */
export function fittedRatio(
  currentRatio: number,
  pixelsPerUnit: number,
  bounds: Bounds,
  width: number,
  height: number,
): number {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const desired = Math.min(width / spanX, height / spanY) * FIT_MARGIN;
  if (!Number.isFinite(currentRatio) || !Number.isFinite(pixelsPerUnit) || pixelsPerUnit <= 0 || desired <= 0) {
    return currentRatio;
  }
  const ratio = currentRatio * (pixelsPerUnit / desired);
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

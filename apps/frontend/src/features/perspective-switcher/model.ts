export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface OverflowEdges {
  /** Content is hidden on the left: show the "previous" arrow. */
  left: boolean;
  /** Content is hidden on the right: show the "next" arrow. */
  right: boolean;
}

/** Sub-pixel slack: fractional widths must not leave an arrow stuck on. */
const EPSILON = 1;

/** Which sides of a horizontal scroller hide content. */
export function overflowEdges({ scrollLeft, scrollWidth, clientWidth }: ScrollMetrics): OverflowEdges {
  return {
    left: scrollLeft > EPSILON,
    right: scrollLeft + clientWidth < scrollWidth - EPSILON,
  };
}

/** How far one arrow click scrolls: most of the visible width, keeping some context. */
export function scrollStep(clientWidth: number): number {
  return Math.max(40, Math.round(clientWidth * 0.7));
}

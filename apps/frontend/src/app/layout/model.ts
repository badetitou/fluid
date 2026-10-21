export const SIDER_MIN_WIDTH = 160;
export const SIDER_MAX_WIDTH = 480;

export const clampSiderWidth = (width: number): number =>
  Math.round(Math.min(SIDER_MAX_WIDTH, Math.max(SIDER_MIN_WIDTH, width)));

/**
 * Width of the sider after dragging its inner edge by `deltaX` pixels. A sider
 * on the right grows when its edge moves left, hence the flipped delta.
 */
export function siderWidthAfterDrag(
  startWidth: number,
  deltaX: number,
  side: 'left' | 'right',
): number {
  return clampSiderWidth(startWidth + (side === 'left' ? deltaX : -deltaX));
}

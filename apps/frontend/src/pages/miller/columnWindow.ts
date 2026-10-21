/** The range of consecutive Miller columns on screen, as column indexes (inclusive). */
export interface ColumnWindow {
  first: number;
  last: number;
}

/** What a drag on the pager's overlay does: slide the window, or move one of its edges. */
export type WindowDrag = 'move' | 'start' | 'end';

/** Horizontal extent of the overlay in pager pixels; `right` includes the trailing gap. */
export interface WindowFrame {
  left: number;
  right: number;
}

/** Columns shown side by side until the user drags the pager's overlay. */
export const DEFAULT_VISIBLE_COLUMNS = 2;

/** Gap between two pager boxes (see `.boxes`). */
export const PAGER_GAP_PX = 3;
/** Horizontal pitch of one pager box: its width (see `.box`) plus the gap. */
export const PAGER_STEP_PX = 10 + PAGER_GAP_PX;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Where the overlay sits when it covers exactly the window's boxes. */
export const frameOf = ({ first, last }: ColumnWindow): WindowFrame => ({
  left: first * PAGER_STEP_PX,
  right: (last + 1) * PAGER_STEP_PX,
});

/**
 * The window after moving one of its edges by `steps` columns (negative is
 * leftwards). It always keeps at least one column and stays within the
 * `count` open columns; there is no other upper bound.
 */
export function resizeWindow(
  { first, last }: ColumnWindow,
  count: number,
  edge: 'start' | 'end',
  steps: number,
): ColumnWindow {
  if (edge === 'start') return { first: clamp(first + steps, 0, last), last };
  return { first, last: clamp(last + steps, first, count - 1) };
}

/** The window slid by `steps` columns, keeping its size. */
export function moveWindow({ first, last }: ColumnWindow, count: number, steps: number): ColumnWindow {
  const next = clamp(first + steps, 0, count - 1 - (last - first));
  return { first: next, last: next + (last - first) };
}

/**
 * A drag of `deltaX` pixels on the overlay of the `start` window: the frame
 * follows the pointer freely (within the pager), and the window is the
 * nearest whole range of columns, which the frame snaps to on release.
 */
export function dragWindow(
  start: ColumnWindow,
  count: number,
  drag: WindowDrag,
  deltaX: number,
): { frame: WindowFrame; window: ColumnWindow } {
  const { left, right } = frameOf(start);
  const at = (px: number) => Math.round(px / PAGER_STEP_PX);
  if (drag === 'move') {
    const nextLeft = clamp(left + deltaX, 0, count * PAGER_STEP_PX - (right - left));
    const window = moveWindow(start, count, at(nextLeft) - start.first);
    return { frame: { left: nextLeft, right: nextLeft + right - left }, window };
  }
  if (drag === 'start') {
    const nextLeft = clamp(left + deltaX, 0, right - PAGER_STEP_PX);
    return { frame: { left: nextLeft, right }, window: { first: at(nextLeft), last: start.last } };
  }
  const nextRight = clamp(right + deltaX, left + PAGER_STEP_PX, count * PAGER_STEP_PX);
  return { frame: { left, right: nextRight }, window: { first: start.first, last: at(nextRight) - 1 } };
}

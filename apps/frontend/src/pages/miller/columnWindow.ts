/** The range of consecutive Miller columns on screen, as column indexes (inclusive). */
export interface ColumnWindow {
  first: number;
  last: number;
}

export type WindowEdge = 'start' | 'end';

/** Columns shown side by side until the user drags the pager's window. */
export const DEFAULT_VISIBLE_COLUMNS = 2;

/** Gap between two pager boxes (see `.boxes`). */
export const PAGER_GAP_PX = 3;
/** Horizontal pitch of one pager box: its width (see `.box`) plus the gap. */
export const PAGER_STEP_PX = 10 + PAGER_GAP_PX;

/**
 * The window after moving one of its edges by `steps` columns (negative is
 * leftwards). It always keeps at least one column and stays within the
 * `count` open columns; there is no other upper bound.
 */
export function resizeWindow(
  { first, last }: ColumnWindow,
  count: number,
  edge: WindowEdge,
  steps: number,
): ColumnWindow {
  if (edge === 'start') return { first: Math.min(last, Math.max(0, first + steps)), last };
  return { first, last: Math.max(first, Math.min(count - 1, last + steps)) };
}

/** Whole columns covered by a drag of `deltaX` pixels on the pager. */
export const dragSteps = (deltaX: number): number => Math.round(deltaX / PAGER_STEP_PX);

/** One more column: the level before the window, or after it when it starts at the root. */
export const growWindow = (window: ColumnWindow, count: number): ColumnWindow =>
  window.first > 0 ? resizeWindow(window, count, 'start', -1) : resizeWindow(window, count, 'end', 1);

/** One column fewer, dropping the leftmost so the deepest level stays on screen. */
export const shrinkWindow = (window: ColumnWindow, count: number): ColumnWindow =>
  resizeWindow(window, count, 'start', 1);

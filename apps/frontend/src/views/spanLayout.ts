// -----------------------------------------------------------------------------
// Span-based layout (views without hand-placed widgets)
// -----------------------------------------------------------------------------
// Widgets flow left to right on Ant's 24-column grid, wrapping when a row is
// full. A row that ends up narrower than the grid — because the next widget
// wrapped, or the spans did not add up — is stretched to the full width,
// keeping the proportions its widgets were authored with: a view never leaves
// an empty strip on the right.
// -----------------------------------------------------------------------------

export const SPAN_COLUMNS = 24;

/**
 * The span of each widget, in order. `spans` are the authored ones (24 when
 * absent); `fit` is how many widgets can share a row at the current width
 * (1 stacks them all full width).
 */
export function rowSpans(spans: Array<number | undefined>, fit: number): number[] {
  if (fit <= 1) return spans.map(() => SPAN_COLUMNS);
  const narrowest = Math.ceil(SPAN_COLUMNS / fit);
  const wanted = spans.map((s) => Math.max(narrowest, Math.min(SPAN_COLUMNS, s ?? SPAN_COLUMNS)));

  const rows: number[][] = [];
  let row: number[] = [];
  let used = 0;
  wanted.forEach((span, i) => {
    if (used + span > SPAN_COLUMNS && row.length > 0) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(i);
    used += span;
  });
  if (row.length > 0) rows.push(row);

  const result = [...wanted];
  for (const indexes of rows) stretch(indexes, wanted, result);
  return result;
}

/** Scales the spans of one row so they add up to the grid's width (rounding given to the widest). */
function stretch(indexes: number[], wanted: number[], result: number[]): void {
  const total = indexes.reduce((sum, i) => sum + wanted[i], 0);
  if (total >= SPAN_COLUMNS) return;
  let given = 0;
  for (const i of indexes) {
    result[i] = Math.max(1, Math.floor((wanted[i] * SPAN_COLUMNS) / total));
    given += result[i];
  }
  const widest = indexes.reduce((best, i) => (wanted[i] > wanted[best] ? i : best), indexes[0]);
  result[widest] += SPAN_COLUMNS - given;
}

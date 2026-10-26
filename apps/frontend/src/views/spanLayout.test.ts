import { describe, expect, it } from 'vitest';
import { rowSpans } from './spanLayout';

describe('rowSpans', () => {
  it('keeps rows that fill the grid as authored', () => {
    expect(rowSpans([18, 6], 4)).toEqual([18, 6]);
    expect(rowSpans([6, 6, 6, 6], 4)).toEqual([6, 6, 6, 6]);
  });

  it('stretches a row left short by a wrapped widget to the full width', () => {
    // Two widgets per row at most: 6 is widened to 12, wraps, and both rows fill the grid.
    expect(rowSpans([18, 6], 2)).toEqual([24, 24]);
    // 8 is widened to 12 too: 16 alone on its row, then 12 + 12.
    expect(rowSpans([16, 8, 12], 2)).toEqual([24, 12, 12]);
  });

  it('keeps the proportions of a row whose spans do not add up', () => {
    expect(rowSpans([8, 4], 6)).toEqual([16, 8]);
    expect(rowSpans([12], 4)).toEqual([24]);
    expect(rowSpans([7, 7, 7], 4)).toEqual([8, 8, 8]);
  });

  it('stacks everything full width when only one widget fits', () => {
    expect(rowSpans([6, 18, undefined], 1)).toEqual([24, 24, 24]);
  });

  it('always fills each row exactly', () => {
    for (const spans of [[5, 5, 5], [10, 3], [1, 2, 3, 4], [24, 13, 11, 9]]) {
      for (const fit of [2, 3, 4, 6]) {
        const out = rowSpans(spans, fit);
        let used = 0;
        for (const span of out) {
          if (used + span > 24) {
            expect(used).toBe(24);
            used = 0;
          }
          used += span;
        }
        expect(used).toBe(24);
      }
    }
  });
});

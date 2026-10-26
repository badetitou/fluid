import { describe, expect, it } from 'vitest';
import { buildBricks, PYRAMID_COLUMNS, PYRAMID_ROWS } from './pyramidLayout';
import { pyramidData, pyramidSpec } from './pyramidFixture';
import { readMetrics, thresholdsFor } from './pyramidModel';

const bricks = buildBricks(readMetrics(pyramidData, pyramidSpec), thresholdsFor(pyramidSpec));
const find = (key: string) => bricks.find((b) => b.key === key)!;

describe('pyramid layout', () => {
  it('fills a 9 × 7 grid without overlap', () => {
    const taken = new Set<string>();
    for (const b of bricks)
      for (let c = b.col; c < b.col + b.span; c++) {
        const cell = `${b.row}:${c}`;
        expect(taken.has(cell)).toBe(false);
        taken.add(cell);
        expect(c).toBeLessThan(PYRAMID_COLUMNS);
        expect(b.row).toBeLessThan(PYRAMID_ROWS);
      }
  });

  it('puts the raw values of size & complexity in one column, the inheritance on top', () => {
    expect(['nop', 'noc', 'nom', 'loc', 'cyclo'].map((k) => find(`value-${k}`).col)).toEqual([5, 5, 5, 5, 5]);
    expect(find('value-loc').text).toBe('24');
    expect(find('label-andc')).toMatchObject({ row: 0, part: 'inheritance', text: 'ANDC' });
  });

  it('colors the ratios against the thresholds (Smalltalk in the example)', () => {
    expect(find('ratio-locNom')).toMatchObject({ text: '8', level: 'high', thresholds: [4.92, 6.91, 8.9] });
    expect(find('ratio-nomNoc')).toMatchObject({ text: '1', level: 'low' });
    expect(find('ratio-andc')).toMatchObject({ text: '0.66', level: 'average', part: 'inheritance' });
  });

  it('leaves the brick of a missing metric empty, and its ratios uncolored', () => {
    const empty = buildBricks(readMetrics(pyramidData, { ...pyramidSpec, calls: undefined }), thresholdsFor(pyramidSpec));
    expect(empty.find((b) => b.key === 'value-calls')?.text).toBe('');
    expect(empty.find((b) => b.key === 'ratio-callsNom')).toMatchObject({ text: '', level: null });
    expect(empty.find((b) => b.key === 'ratio-fanoutCalls')?.level).toBeNull();
  });
});

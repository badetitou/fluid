import { describe, expect, it } from 'vitest';
import { diffRows, diffStats, foldRows, plainRows } from './diffModel';

const kinds = (rows: { kind: string; text: string }[]) => rows.map((r) => `${r.kind[0]} ${r.text}`);

describe('diffRows', () => {
  it('keeps identical texts unchanged', () => {
    expect(diffRows('a\nb', 'a\nb\n')).toEqual(plainRows('a\nb'));
  });

  it('shows a changed line as removed then added, with both numberings', () => {
    const rows = diffRows('a\nb\nc', 'a\nB\nc\nd');
    expect(kinds(rows)).toEqual(['s a', 'r b', 'a B', 's c', 'a d']);
    expect(rows.map((r) => [r.oldNo, r.newNo])).toEqual([[1, 1], [2, undefined], [undefined, 2], [3, 3], [undefined, 4]]);
    expect(diffStats(rows)).toEqual({ added: 2, removed: 1 });
  });

  it('matches moved-around lines with the longest common subsequence', () => {
    expect(kinds(diffRows('x\na\nb\ny', 'x\nb\na\ny'))).toEqual(['s x', 'r a', 's b', 'a a', 's y']);
  });

  it('handles empty sides and Windows line breaks', () => {
    expect(kinds(diffRows('', 'a'))).toEqual(['r ', 'a a']);
    expect(kinds(diffRows('a\r\nb', 'a\nb'))).toEqual(['s a', 's b']);
  });
});

describe('foldRows', () => {
  const rows = diffRows(Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n'), Array.from({ length: 20 }, (_, i) => (i === 10 ? 'changed' : `l${i}`)).join('\n'));

  it('folds unchanged runs away from the changes', () => {
    const items = foldRows(rows, 2);
    expect(items[0]).toEqual({ kind: 'fold', from: 0, to: 8 });
    expect(items.filter((i) => i.kind !== 'fold')).toHaveLength(6);
    expect(items.at(-1)).toEqual({ kind: 'fold', from: 14, to: 21 });
  });

  it('keeps the rows asked for visible, and never folds a single line', () => {
    const items = foldRows(rows, 2, (r) => r.newNo === 1);
    expect(items.slice(0, 3).map((i) => i.kind)).toEqual(['same', 'same', 'same']);
    expect(foldRows(rows, 9).some((i) => i.kind === 'fold')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { textSegments } from './textModel';

const shown = (text: string, highlights?: { start: number; end: number }[]) =>
  textSegments(text, highlights).map((s) => (s.highlighted ? `[${s.content}]` : s.content)).join('');

describe('textSegments', () => {
  it('keeps the whole text when nothing is highlighted', () => {
    expect(textSegments('foo')).toEqual([{ content: 'foo', highlighted: false }]);
    expect(textSegments('')).toEqual([{ content: '', highlighted: false }]);
  });

  it('cuts the text around a range, end exclusive', () => {
    expect(shown('abstract makeSound(): void;', [{ start: 9, end: 18 }])).toBe('abstract [makeSound](): void;');
  });

  it('handles ranges at the edges, out of order, overlapping or past the end', () => {
    expect(shown('abcdef', [{ start: 0, end: 2 }])).toBe('[ab]cdef');
    expect(shown('abcdef', [{ start: 4, end: 99 }])).toBe('abcd[ef]');
    expect(shown('abcdef', [{ start: 3, end: 4 }, { start: 0, end: 1 }])).toBe('[a]bc[d]ef');
    expect(shown('abcdef', [{ start: 1, end: 4 }, { start: 2, end: 5 }])).toBe('a[bcd][e]f');
    expect(shown('abcdef', [{ start: 2, end: 2 }, { start: 10, end: 12 }])).toBe('abcdef');
  });
});

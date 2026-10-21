import { describe, expect, it } from 'vitest';
import { annotationMark, findAll, rowMarks, searchRows, segmentLine } from './markModel';

describe('search', () => {
  it('finds every case-insensitive occurrence', () => {
    expect(findAll('Foo foo', 'FOO')).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }]);
    expect(findAll('aaa', 'aa')).toEqual([{ start: 0, end: 2 }]);
    expect(searchRows(['x', 'ax'], 'x')).toEqual([{ row: 0, start: 0, end: 1 }, { row: 1, start: 1, end: 2 }]);
    expect(searchRows(['x'], '')).toEqual([]);
  });
});

describe('annotationMark', () => {
  const a = { line: 2, endLine: 3, column: 3, endColumn: 5, message: 'm', severity: 'error' as const, rule: 'R' };

  it('covers its columns on its first and last lines, the whole line in between', () => {
    expect(annotationMark(a, 2, 10)).toEqual({ start: 2, end: 10, kind: 'error', title: 'R: m' });
    expect(annotationMark(a, 3, 10)).toMatchObject({ start: 0, end: 4 });
    expect(annotationMark(a, 4, 10)).toBeUndefined();
    expect(annotationMark({ ...a, column: undefined, endColumn: undefined, endLine: 2 }, 2, 6)).toMatchObject({ start: 0, end: 6 });
  });
});

describe('segmentLine', () => {
  const tokens = [{ types: ['keyword'], content: 'return' }, { types: ['plain'], content: ' x' }];

  it('keeps tokens whole without marks', () => {
    expect(segmentLine(tokens, []).map((s) => s.content)).toEqual(['return', ' x']);
  });

  it('cuts tokens at mark edges, keeping syntax types and stacking marks', () => {
    const segments = segmentLine(tokens, [
      { start: 3, end: 8, kind: 'match' },
      { start: 0, end: 8, kind: 'warning' },
    ]);
    expect(segments.map((s) => [s.content, s.types[0], s.marks.map((m) => m.kind).join('+')])).toEqual([
      ['ret', 'keyword', 'warning'],
      ['urn', 'keyword', 'warning+match'],
      [' x', 'plain', 'warning+match'],
    ]);
  });
});

describe('rowMarks', () => {
  it('gathers terms, hits and annotations of a row', () => {
    const hit = { row: 0, start: 0, end: 2 };
    const annotation = { line: 4, endLine: 4, message: 'm', severity: 'info' as const };
    const marks = rowMarks('Halt halt', 4, { terms: ['halt'], hits: [hit], current: hit, annotations: [annotation] });
    expect(marks.map((m) => `${m.kind}@${m.start}`)).toEqual(['info@0', 'term@0', 'term@5', 'current@0']);
    expect(rowMarks('x', undefined, { terms: [], hits: [], annotations: [annotation] })).toEqual([]);
  });
});

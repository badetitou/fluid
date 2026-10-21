import { describe, expect, it } from 'vitest';
import { annotationsByLine, normalizeSeverity, positionOf, readAnnotations, severityCounts, worstSeverity } from './annotationModel';

describe('normalizeSeverity', () => {
  it('maps the usual words and levels', () => {
    expect(['ERROR', 'high', 'blocker', 2].map(normalizeSeverity)).toEqual(['error', 'error', 'error', 'error']);
    expect(['warning', 'Major', 1].map(normalizeSeverity)).toEqual(['warning', 'warning', 'warning']);
    expect(['hint', undefined, 0].map(normalizeSeverity)).toEqual(['info', 'info', 'info']);
    expect(worstSeverity(['info', 'error', 'warning'])).toBe('error');
  });
});

describe('readAnnotations', () => {
  const source = 'foo\n  ^ self bar\nbaz';

  it('reads lines and columns', () => {
    const rows = [{ l: 2, c: 5, e: 9, msg: 'Sends bar', sev: 'warning', rule: 'R1' }, { msg: 'no position' }];
    const spec = { lineField: 'l', columnField: 'c', endColumnField: 'e', messageField: 'msg', severityField: 'sev', ruleField: 'rule' };
    expect(readAnnotations(rows, spec, source)).toEqual([
      { line: 2, endLine: 2, column: 5, endColumn: 9, message: 'Sends bar', severity: 'warning', rule: 'R1' },
    ]);
  });

  it('turns character offsets into positions, 0-based or 1-based inclusive', () => {
    const zero = readAnnotations([{ s: 4, e: 16, m: 'x' }], { startOffsetField: 's', endOffsetField: 'e', messageField: 'm' }, source);
    expect(zero[0]).toMatchObject({ line: 2, column: 1, endLine: 2, endColumn: 13 });
    // Pharo interval of "self" in line 2: characters 9 to 12.
    const one = readAnnotations([{ i: { start: 9, stop: 12 }, m: 'x' }], { startOffsetField: 'i.start', endOffsetField: 'i.stop', offsetBase: 1, messageField: 'm' }, source);
    expect(one[0]).toMatchObject({ line: 2, column: 5, endLine: 2, endColumn: 9 });
    expect(positionOf(source, 17)).toEqual({ line: 3, column: 1 });
  });

  it('groups by start line, most severe first, and counts', () => {
    const list = readAnnotations([{ l: 1, m: 'a', s: 'info' }, { l: 1, m: 'b', s: 'error' }, { l: 3, m: 'c' }], { lineField: 'l', messageField: 'm', severityField: 's' }, source);
    expect(annotationsByLine(list).get(1)?.map((a) => a.message)).toEqual(['b', 'a']);
    expect(severityCounts(list)).toEqual({ error: 1, warning: 0, info: 2 });
  });
});

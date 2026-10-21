import { describe, expect, it } from 'vitest';
import type { CodeWidget, DataBinding } from '@fluid/shared';
import { readCodeSources } from './codeModel';

const base: CodeWidget = { id: 'c', type: 'code', data: { query: 'm', path: 'm' }, field: 'src' };
const results: Record<string, unknown> = { old: { v: { src: 'old' } }, lint: { issues: [{ line: 1 }] } };
const resolve = (b: DataBinding) => (b.path ? (results[b.query] as Record<string, unknown>)[b.path] : results[b.query]);
const method = { src: 'new', previous: { src: 'prev' }, critiques: [{ line: 2 }] };

describe('readCodeSources', () => {
  it('reads the source alone', () => {
    expect(readCodeSources(base, method, resolve)).toEqual({ source: 'new', before: undefined, annotationRows: [] });
  });

  it('reads the compared version and annotations from the bound object', () => {
    const widget: CodeWidget = { ...base, compare: { field: 'previous.src' }, annotations: { field: 'critiques', messageField: 'm' } };
    expect(readCodeSources(widget, method, resolve)).toEqual({ source: 'new', before: 'prev', annotationRows: [{ line: 2 }] });
  });

  it('reads them from other queries', () => {
    const widget: CodeWidget = {
      ...base,
      compare: { data: { query: 'old', path: 'v' }, field: 'src' },
      annotations: { data: { query: 'lint' }, field: 'issues', messageField: 'm' },
    };
    expect(readCodeSources(widget, method, resolve)).toMatchObject({ before: 'old', annotationRows: [{ line: 1 }] });
  });
});

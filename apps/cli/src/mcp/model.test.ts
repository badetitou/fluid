import { describe, expect, it } from 'vitest';
import type { SpecInfo } from './fluidApi';
import { countRows, errorText, summarizeRun, summarizeSources, summarizeViews } from './model';

const spec: SpecInfo = {
  title: 'Characters',
  queries: {},
  widgets: [{ type: 'table' }, { type: 'statistic' }, { type: 'statistic' }],
};

describe('summarizeSources', () => {
  it('keeps public fields only and reports signedIn for OAuth sources', () => {
    const out = summarizeSources([
      { id: 'a', name: 'Rick', url: 'https://r', authKind: 'none', hasSecret: true },
      { id: 'b', name: 'Corp', url: 'https://c', authKind: 'oauth', oauth: { signedIn: false } },
    ]);
    expect(out).toEqual([
      { id: 'a', name: 'Rick', url: 'https://r', authKind: 'none' },
      { id: 'b', name: 'Corp', url: 'https://c', authKind: 'oauth', signedIn: false },
    ]);
  });
});

describe('summarizeViews', () => {
  it('returns id, title and concept', () => {
    expect(summarizeViews([{ id: '1', title: 'T', concept: 'C', spec: {} }])).toEqual([{ id: '1', title: 'T', concept: 'C' }]);
  });
});

describe('countRows', () => {
  it('finds the first nested array', () => {
    expect(countRows({ characters: { results: [1, 2, 3] } })).toBe(3);
    expect(countRows({ a: [1] })).toBe(1);
    expect(countRows({ a: { b: 1 } })).toBeNull();
    expect(countRows(null)).toBeNull();
  });
});

describe('summarizeRun', () => {
  it('lists widgets, rows, errors and skipped queries', () => {
    const text = summarizeRun(spec, {
      results: {
        list: { data: { characters: [{ id: 1 }, { id: 2 }] } },
        one: { data: { character: { id: 1 } } },
        bad: { errors: [{ message: 'boom' }] },
      },
      skipped: ['plugin'],
    });
    expect(text).toContain('View "Characters": 3 widgets (table, statistic x2).');
    expect(text).toContain('- list: 2 rows');
    expect(text).toContain('- one: data');
    expect(text).toContain('- bad: no data, 1 error: boom');
    expect(text).toContain('Skipped (plugin data sources run in the browser): plugin.');
  });

  it('handles a view without widgets or queries', () => {
    const text = summarizeRun({ title: 'Empty', queries: {}, widgets: [] }, { results: {} });
    expect(text).toBe('View "Empty": no widgets.\nNo query ran.');
  });
});

describe('errorText', () => {
  it('has the documented wording', () => {
    expect(errorText('unreachable', { baseUrl: 'http://x:1' })).toBe(
      'fluid is not reachable at http://x:1: start it with `npx @badetitou/fluid`',
    );
    expect(errorText('auth-required', { baseUrl: '', sourceName: 'Corp' })).toBe(
      "Sign in to Corp from fluid's settings (Settings → Connection)",
    );
    expect(errorText('not-found', { baseUrl: '', detail: 'View not found' })).toContain('View not found');
  });
});

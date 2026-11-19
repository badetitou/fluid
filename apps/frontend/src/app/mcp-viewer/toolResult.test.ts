import { describe, expect, it } from 'vitest';
import { SPEC } from './fixtures';
import { parseRunResult, parseToolResult } from './toolResult';

const view = (over: object = {}) => ({
  content: [{ type: 'text', text: 'ok' }],
  structuredContent: { viewId: 'v1', sourceId: 's1', take: 100, spec: SPEC, data: { list: { data: { characters: [{ id: '1', name: 'Rick' }] } } }, ...over },
});

describe('parseToolResult', () => {
  it('returns the view with its data', () => {
    const r = parseToolResult(view());
    expect(r.kind).toBe('view');
    if (r.kind === 'view') {
      expect(r.payload.spec.title).toBe('Characters');
      expect(r.payload.take).toBe(100);
      expect(r.payload.data.list.data).toEqual({ characters: [{ id: '1', name: 'Rick' }] });
    }
  });

  it('turns a tool error into the text to show', () => {
    expect(parseToolResult({ isError: true, content: [{ type: 'text', text: 'Sign in first' }] })).toEqual({ kind: 'error', message: 'Sign in first' });
  });

  it('refuses what is not a view or has an invalid spec', () => {
    expect(parseToolResult(null).kind).toBe('error');
    expect(parseToolResult({ structuredContent: { hello: 1 } }).kind).toBe('error');
    expect(parseToolResult(view({ spec: { title: 'x' } })).kind).toBe('error');
    expect(parseToolResult(view({ data: 'no' })).kind).toBe('error');
  });
});

describe('parseRunResult', () => {
  it('returns the results map', () => {
    expect(parseRunResult({ structuredContent: { results: { list: { data: { a: 1 } } } } })).toEqual({ list: { data: { a: 1 } } });
  });
  it('throws the tool error or on a bad shape', () => {
    expect(() => parseRunResult({ isError: true, content: [{ type: 'text', text: 'too large' }] })).toThrow('too large');
    expect(() => parseRunResult({ structuredContent: { nope: 1 } })).toThrow();
  });
});

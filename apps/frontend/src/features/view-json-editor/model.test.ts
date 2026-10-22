import { describe, expect, it } from 'vitest';
import { parseViewSpecText } from './model';

const valid = JSON.stringify({ version: 1, id: 'v', concept: 'X', title: 'old', queries: {}, widgets: [] });

describe('parseViewSpecText', () => {
  it('requires a title', () => {
    expect(parseViewSpecText(valid, '  ', 'Account')).toEqual({ ok: false, error: 'A title is required.' });
  });

  it('reports invalid JSON', () => {
    const res = parseViewSpecText('{', 'T', 'Account');
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/^Invalid JSON/);
  });

  it('reports schema issues with their path', () => {
    const res = parseViewSpecText(JSON.stringify({ version: 1 }), 'T', 'Account');
    expect(!res.ok && res.error).toMatch(/^Invalid view spec:\n/);
  });

  it('reports an action refetching an unknown query', () => {
    const spec = { ...JSON.parse(valid), actions: { reset: { mutation: 'mutation { reset }', refetch: ['rows'] } } };
    const res = parseViewSpecText(JSON.stringify(spec), 'T', 'Account');
    expect(!res.ok && res.error).toBe('Invalid view spec:\nactions.reset.refetch: "rows" is not a query of the view.');
  });

  it('applies the title and concept to a valid spec', () => {
    const res = parseViewSpecText(valid, ' New ', 'Account');
    expect(res.ok && res.spec).toMatchObject({ title: 'New', concept: 'Account', id: 'v' });
  });
});

import { decoratorSpecSchema } from '@fluid/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecoratorEntry } from './graphDecorator';
import { clearSarifCache } from './importsClient';
import { useImportedLogs } from './useImportedLogs';

const entry = (id: string, imports: { id: string; url: string }[]): DecoratorEntry => ({
  spec: decoratorSpecSchema.parse({ id, label: id, imports: imports.map((i) => ({ ...i, format: 'sarif' })) }),
  baseUrl: 'https://p.example/m.json',
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSarifCache();
});

describe('useImportedLogs', () => {
  it('merges invalid-URL errors with fetch errors, and keeps the loaded logs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('ok.json') ? new Response(JSON.stringify({ runs: [] })) : new Response('', { status: 500 }),
      ),
    );
    const entries = [
      entry('q', [
        { id: 'ok', url: 'ok.json' },
        { id: 'down', url: 'down.json' },
        { id: 'bad', url: 'http://example.com/x.json' },
      ]),
    ];
    const { result } = renderHook(() => useImportedLogs(entries));
    await waitFor(() => expect(result.current.imported.has('q/ok')).toBe(true));
    expect(Object.keys(result.current.errors).sort()).toEqual(['q/bad', 'q/down']);
    expect(result.current.errors['q/down']).toContain('HTTP 500');
  });

  it('drops what is no longer requested at once, and resets without requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ runs: [] }))));
    const first = [entry('q', [{ id: 'a', url: 'a.json' }])];
    const { result, rerender } = renderHook(({ entries }) => useImportedLogs(entries), {
      initialProps: { entries: first },
    });
    await waitFor(() => expect(result.current.imported.has('q/a')).toBe(true));
    rerender({ entries: [entry('q', [{ id: 'b', url: 'b.json' }])] });
    expect(result.current.imported.has('q/a')).toBe(false);
    await waitFor(() => expect(result.current.imported.has('q/b')).toBe(true));
    rerender({ entries: [] });
    expect(result.current.imported.size).toBe(0);
    expect(result.current.errors).toEqual({});
  });
});

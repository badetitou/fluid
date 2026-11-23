import { decoratorSpecSchema } from '@fluid/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSarifCache, fetchSarifLog } from './importsClient';
import { importRequests, parseSarifLog, resolveImportUrl } from './importsModel';

const ORIGIN = 'http://localhost:5173';

describe('import URLs', () => {
  it('resolve against the plugin manifest, else against the page', () => {
    const manifest = 'https://plugins.example/lint/manifest.json';
    expect(resolveImportUrl('out/lint.sarif', manifest, ORIGIN)).toBe('https://plugins.example/lint/out/lint.sarif');
    expect(resolveImportUrl('/lint.sarif', undefined, ORIGIN)).toBe('http://localhost:5173/lint.sarif');
    expect(resolveImportUrl('https://other.example/a.sarif', manifest, ORIGIN)).toBe('https://other.example/a.sarif');
  });

  it('refuse what a manifest could not be read from', () => {
    expect(() => resolveImportUrl('http://example.com/a.sarif', undefined, ORIGIN)).toThrow('Imports are read');
  });

  it('are keyed by decorator and import ids; a bad one is reported, not thrown', () => {
    const spec = decoratorSpecSchema.parse({
      id: 'quality',
      label: 'Quality',
      imports: [
        { id: 'lint', format: 'sarif', url: 'lint.json' },
        { id: 'bad', format: 'sarif', url: 'http://example.com/x.json' },
      ],
    });
    const { requests, errors } = importRequests([{ spec, baseUrl: 'https://p.example/m.json' }], ORIGIN);
    expect(requests).toEqual([{ key: 'quality/lint', url: 'https://p.example/lint.json' }]);
    expect(Object.keys(errors)).toEqual(['quality/bad']);
  });
});

describe('imported logs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSarifCache();
  });

  it('are validated as SARIF', () => {
    expect(parseSarifLog({ runs: [] }).runs).toEqual([]);
    expect(() => parseSarifLog({ nope: 1 })).toThrow('not a SARIF log');
  });

  it('are fetched once per URL, and a failure is not cached', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValue(new Response(JSON.stringify({ runs: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchSarifLog('https://x.example/a.sarif')).rejects.toThrow('HTTP 404');
    await expect(fetchSarifLog('https://x.example/a.sarif')).resolves.toEqual({ runs: [] });
    await fetchSarifLog('https://x.example/a.sarif');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

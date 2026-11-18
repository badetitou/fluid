import { describe, expect, it } from 'vitest';
import { createSafeFetch } from './safe-fetch';

const respond = (make: (url: string) => Response) => (async (url: URL | string) => make(String(url))) as typeof fetch;

describe('safe fetch', () => {
  it('refuses non-http(s) URLs', async () => {
    const f = createSafeFetch({ fetchImpl: respond(() => new Response('{}')) });
    await expect(f('file:///etc/passwd')).rejects.toThrow('http');
  });

  it('follows a same-origin redirect on GET but refuses a cross-origin one', async () => {
    const seen: string[] = [];
    const f = createSafeFetch({
      fetchImpl: respond((url) => {
        seen.push(url);
        if (url === 'https://a.test/x') return new Response(null, { status: 302, headers: { location: '/y' } });
        if (url === 'https://a.test/z') return new Response(null, { status: 302, headers: { location: 'https://b.test/y' } });
        return new Response('ok');
      }),
    });
    expect(await (await f('https://a.test/x')).text()).toBe('ok');
    expect(seen).toEqual(['https://a.test/x', 'https://a.test/y']);
    await expect(f('https://a.test/z')).rejects.toThrow('Redirect refused');
    expect(seen).not.toContain('https://b.test/y');
  });

  it('never follows a redirect on POST (the body may hold credentials)', async () => {
    const f = createSafeFetch({
      fetchImpl: respond(() => new Response(null, { status: 307, headers: { location: '/y' } })),
    });
    await expect(f('https://a.test/token', { method: 'POST', body: 'x' })).rejects.toThrow('Redirect refused');
  });

  it('caps the response size', async () => {
    const f = createSafeFetch({ maxBytes: 10, fetchImpl: respond(() => new Response('x'.repeat(100))) });
    await expect(f('https://a.test/')).rejects.toThrow('too large');
  });
});

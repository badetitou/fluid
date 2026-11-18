import { describe, expect, it } from 'vitest';
import { forwardGraphql } from './proxy';
import { isNotFound } from './repository';

const body = { query: '{ ok }' };

describe('forwardGraphql', () => {
  it('answers 504 when the upstream is slower than the timeout', async () => {
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    const res = await forwardGraphql('http://x.test/g', {}, body, { timeoutMs: 20, fetchImpl: slow });
    expect(res).toEqual({ status: 504, body: { errors: [{ message: 'Source timed out' }] } });
  });

  it('answers 502 when the upstream body is above maxBytes', async () => {
    const big = (async () => new Response(JSON.stringify({ data: { s: 'x'.repeat(200) } }))) as typeof fetch;
    const res = await forwardGraphql('http://x.test/g', {}, body, { maxBytes: 50, fetchImpl: big });
    expect(res.status).toBe(502);
    expect(res.body.errors?.[0].message).toMatch(/too large/);
  });

  it('answers 502 on a network error', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect((await forwardGraphql('http://x.test/g', {}, body, { fetchImpl: down })).status).toBe(502);
  });
});

describe('isNotFound', () => {
  it('matches only the Prisma not-found code', () => {
    expect(isNotFound({ code: 'P2025' })).toBe(true);
    expect(isNotFound({ code: 'P1001' })).toBe(false);
    expect(isNotFound(new Error('db down'))).toBe(false);
  });
});

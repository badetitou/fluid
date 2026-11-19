import { describe, expect, it } from 'vitest';
import { createFluidApi, FluidApiError } from './fluidApi';

const reply = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch;

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    if (err instanceof FluidApiError) return { kind: err.kind, message: err.message };
    throw err;
  }
  return null;
};

describe('createFluidApi', () => {
  it('maps a 500 with an error field to a one-line, bounded http error', async () => {
    const long = `bad\nthing ${'x'.repeat(500)}`;
    const e = await failure(createFluidApi('http://f', reply(500, { error: long })).listSources());
    expect(e?.kind).toBe('http');
    expect(e?.message).not.toContain('\n');
    expect(e?.message.length).toBeLessThan(260);
  });

  it('maps a 500 without an error field', async () => {
    expect(await failure(createFluidApi('http://f', reply(500, 'oops')).listSources())).toEqual({
      kind: 'http',
      message: 'fluid answered 500',
    });
  });

  it('rejects a wrong shape as invalid without echoing the body', async () => {
    const e = await failure(createFluidApi('http://f', reply(200, [{ secret: 'hunter2' }])).listSources());
    expect(e?.kind).toBe('invalid');
    expect(e?.message).not.toContain('hunter2');
  });

  it('distinguishes a timeout from an unreachable fluid', async () => {
    const slow: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    expect((await failure(createFluidApi('http://f', slow, 20).listSources()))?.kind).toBe('timeout');
    const down: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect((await failure(createFluidApi('http://f', down).listSources()))?.kind).toBe('unreachable');
  });

  it('maps 401 with FLUID_AUTH_REQUIRED and 404', async () => {
    const auth = { errors: [{ message: 'x', extensions: { code: 'FLUID_AUTH_REQUIRED' } }] };
    const run = createFluidApi('http://f', reply(401, auth)).runView('v', { sourceId: 's' });
    expect((await failure(run))?.kind).toBe('auth-required');
    expect((await failure(createFluidApi('http://f', reply(404, { error: 'View not found' })).getView('v')))?.kind).toBe('not-found');
  });
});

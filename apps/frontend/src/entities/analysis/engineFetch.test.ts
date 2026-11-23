import { describe, expect, it, vi } from 'vitest';
import { createEngineFetch } from './engineFetch';

describe('createEngineFetch', () => {
  it('answers a GraphQL POST with the engine', async () => {
    const execute = vi.fn().mockResolvedValue({ data: { ok: true } });
    const run = createEngineFetch(() => ({ execute, dispose: vi.fn() }));
    const res = await run('model-wasm://a/b', { method: 'POST', body: JSON.stringify({ query: '{ ok }' }) });
    expect(await res.json()).toEqual({ data: { ok: true } });
    expect(execute).toHaveBeenCalledWith({ query: '{ ok }' });
  });
  it('reports an engine failure as a GraphQL error', async () => {
    const run = createEngineFetch(() => ({ execute: () => Promise.reject(new Error('boom')), dispose: vi.fn() }));
    const res = await run('x', { body: '{"query":"{a}"}' });
    expect(res.status).toBe(500);
    expect((await res.json()).errors[0].message).toBe('boom');
  });
  it('refuses when no engine is loaded or the body is not JSON', async () => {
    expect((await createEngineFetch(() => undefined)('x', { body: '{}' })).status).toBe(503);
    const run = createEngineFetch(() => ({ execute: vi.fn(), dispose: vi.fn() }));
    expect((await run('x', { body: 'nope' })).status).toBe(400);
  });
});

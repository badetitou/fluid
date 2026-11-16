import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

const INDEX = '<!doctype html><html><body>fluid-test-index</body></html>';

describe('BFF static serving', () => {
  let app: FastifyInstance;
  let plain: FastifyInstance;

  beforeAll(async () => {
    // db.ts only builds a lazy client (no connection until a query), but needs a URL.
    process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:1/x';
    delete process.env.FLUID_STATIC_DIR;
    process.env.FLUID_IMAGE_HOSTS = 'a.com';
    const dir = mkdtempSync(join(tmpdir(), 'fluid-static-'));
    writeFileSync(join(dir, 'index.html'), INDEX);
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
    const { buildApp } = await import('./app');
    app = buildApp({ staticDir: dir });
    plain = buildApp();
    await app.ready();
    await plain.ready();
  });

  it('serves index.html at / with no-store', async () => {
    const res = await app.inject('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('serves static assets', async () => {
    const res = await app.inject('/assets/app.js');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(1)');
  });

  it('falls back to index.html for deep links', async () => {
    const res = await app.inject('/some/deep/link');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX);
  });

  it('returns JSON 404 for unknown /api paths', async () => {
    const res = await app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('serves generated /config.js with no-store', async () => {
    const res = await app.inject('/config.js');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.body).toContain('window.__FLUID_CONFIG__');
    expect(res.body).toContain('"bffUrl": ""');
    expect(res.body).toContain('"a.com"');
  });

  it('keeps /health working', async () => {
    const res = await app.inject('/health');
    expect(res.json()).toEqual({ status: 'ok', service: 'fluid-bff' });
  });

  it('without a static dir, / is a plain 404', async () => {
    expect((await plain.inject('/')).statusCode).toBe(404);
    expect((await plain.inject('/health')).statusCode).toBe(200);
  });
});

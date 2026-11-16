import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

  it('returns exact JSON 404 for /api and /api?x=1', async () => {
    for (const url of ['/api', '/api?x=1']) {
      const res = await app.inject(url);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'Not found' });
    }
  });

  it('treats /apiary as a deep link', async () => {
    const res = await app.inject('/apiary');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX);
  });

  it('returns JSON 404 for POST on a deep link', async () => {
    const res = await app.inject({ method: 'POST', url: '/some/deep/link' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Not found' });
  });

  it('answers HEAD on a deep link with 200', async () => {
    const res = await app.inject({ method: 'HEAD', url: '/some/deep/link' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 for missing built assets, not index.html', async () => {
    for (const method of ['GET', 'HEAD'] as const) {
      const res = await app.inject({ method, url: '/assets/missing.js' });
      expect(res.statusCode).toBe(404);
    }
    expect((await app.inject('/assets/missing.js')).json()).toEqual({ error: 'Not found' });
  });

  it('keeps dots in deep link ids on the SPA fallback', async () => {
    const res = await app.inject('/entity/a.b.c');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX);
  });

  it('without a static dir, /config.js is 404', async () => {
    expect((await plain.inject('/config.js')).statusCode).toBe(404);
  });
});

describe('BFF static dir resolution', () => {
  const saved = process.env.FLUID_STATIC_DIR;
  afterEach(() => {
    if (saved === undefined) delete process.env.FLUID_STATIC_DIR;
    else process.env.FLUID_STATIC_DIR = saved;
  });

  function makeDir(withIndex = true): string {
    const dir = mkdtempSync(join(tmpdir(), 'fluid-static-'));
    if (withIndex) writeFileSync(join(dir, 'index.html'), INDEX);
    return dir;
  }

  it('picks up process.env.FLUID_STATIC_DIR', async () => {
    process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:1/x';
    process.env.FLUID_STATIC_DIR = makeDir();
    const { buildApp } = await import('./app');
    const app = buildApp();
    await app.ready();
    expect((await app.inject('/')).body).toBe(INDEX);
    await app.close();
  });

  it('accepts a relative dir', async () => {
    process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:1/x';
    const { buildApp } = await import('./app');
    const app = buildApp({ staticDir: relative(process.cwd(), makeDir()) });
    await app.ready();
    expect((await app.inject('/')).body).toBe(INDEX);
    await app.close();
  });

  it('fails at startup when index.html is missing', async () => {
    process.env.DATABASE_URL ??= 'postgresql://x:x@127.0.0.1:1/x';
    const dir = makeDir(false);
    const { buildApp } = await import('./app');
    const app = buildApp({ staticDir: dir });
    await expect(app.ready()).rejects.toThrow(/does not contain index\.html/);
    await expect(app.ready()).rejects.toThrow(dir.replace(/^\/private/, ''));
  });
});

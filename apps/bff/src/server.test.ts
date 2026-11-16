import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS_DIR } from './storage/client';

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const view = { spec: { id: 't', concept: 'Character', title: 'T', queries: {}, widgets: [] } };
const base = { host: '127.0.0.1', migrationsDir: MIGRATIONS_DIR, logLevel: 'silent' };

// db.ts resolves the storage mode at import time, so set the env and re-import per test.
async function loadServer(dataDir: string) {
  process.env.FLUID_DATA_DIR = dataDir;
  vi.resetModules();
  return import('./server');
}

describe('startServer', () => {
  let staticDir: string;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    staticDir = tmp('fluid-srv-static-');
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html><html><body>hi</body></html>');
  });
  afterEach(() => {
    process.env.FLUID_DATA_DIR = 'memory://';
  });

  it('serves the app, stores a view and closes', async () => {
    const { startServer } = await loadServer('memory://');
    const server = await startServer({ ...base, port: 0, staticDir });
    try {
      expect(server.port).toBeGreaterThan(0);
      const root = await fetch(`${server.url}/`);
      expect(root.headers.get('content-type')).toContain('text/html');
      const post = await fetch(`${server.url}/api/views`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(view),
      });
      expect(post.status).toBeLessThan(300);
      expect(await (await fetch(`${server.url}/api/views`)).text()).toContain('"T"');
    } finally {
      await expect(server.close()).resolves.toBeUndefined();
    }
  });

  it('releases the lock when listen fails', async () => {
    const dataDir = tmp('fluid-srv-data-');
    const busy = createServer();
    await new Promise<void>((r) => busy.listen(0, '127.0.0.1', r));
    const taken = (busy.address() as { port: number }).port;
    try {
      const { startServer } = await loadServer(dataDir);
      await expect(startServer({ ...base, port: taken })).rejects.toMatchObject({ code: 'EADDRINUSE' });
      expect(existsSync(join(dataDir, 'fluid.lock'))).toBe(false);
    } finally {
      busy.close();
    }
  });

  it('releases the lock when migrations fail', async () => {
    const dataDir = tmp('fluid-srv-data-');
    const bad = tmp('fluid-srv-mig-');
    mkdirSync(join(bad, '0001_bad'));
    writeFileSync(join(bad, '0001_bad', 'migration.sql'), 'THIS IS NOT SQL;');
    const { startServer } = await loadServer(dataDir);
    await expect(startServer({ ...base, port: 0, migrationsDir: bad })).rejects.toThrow();
    expect(existsSync(join(dataDir, 'fluid.lock'))).toBe(false);
  });

  it('reports a held lock with a code, pid and dir', async () => {
    const dataDir = tmp('fluid-srv-data-');
    writeFileSync(join(dataDir, 'fluid.lock'), String(process.ppid));
    const { startServer } = await loadServer(dataDir);
    await expect(startServer({ ...base, port: 0 })).rejects.toMatchObject({
      code: 'FLUID_DATA_DIR_LOCKED',
      pid: process.ppid,
      dir: dataDir,
    });
    // The failed start must leave the other process's lock untouched.
    expect(readFileSync(join(dataDir, 'fluid.lock'), 'utf8')).toBe(String(process.ppid));
  });
});

import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from './client';

describe('PGlite persistence and locking', () => {
  let dir: string;
  const open: Storage[] = [];
  const make = () => {
    const s = createStorage({ kind: 'pglite', dataDir: dir });
    open.push(s);
    return s;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fluid-pglite-'));
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps data across restarts and applies no migration twice', async () => {
    const first = make();
    await first.init();
    const view = await first.prisma.view.create({ data: { concept: 'C', title: 'T', spec: { a: 1 } } });
    await first.close();
    expect(existsSync(join(dir, 'fluid.lock'))).toBe(false);

    const second = make();
    await second.init();
    expect((await second.prisma.view.findUnique({ where: { id: view.id } }))?.spec).toEqual({ a: 1 });
    const tracked = await second.prisma.$queryRawUnsafe<{ n: bigint }[]>(
      'SELECT count(*) AS n FROM "_fluid_migrations"',
    );
    const rows = await second.prisma.$queryRawUnsafe<{ name: string; applied_at: Date }[]>(
      'SELECT name, applied_at FROM "_fluid_migrations"',
    );
    expect(Number(tracked[0]?.n)).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('applyMigrations returns nothing on a second run', async () => {
    const { applyMigrations } = await import('./migrate');
    const { MIGRATIONS_DIR } = await import('./client');
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite(dir);
    try {
      expect((await applyMigrations(pg, MIGRATIONS_DIR)).length).toBeGreaterThan(0);
      expect(await applyMigrations(pg, MIGRATIONS_DIR)).toEqual([]);
    } finally {
      await pg.close();
    }
  });

  it('refuses a second storage on the same dir while the first is open', async () => {
    await make().init();
    await expect(make().init()).rejects.toThrow(`data dir ${dir} is in use by process ${process.pid}`);
  });

  it('takes over a stale lock left by a dead process', async () => {
    writeFileSync(join(dir, 'fluid.lock'), '2147483646');
    const s = make();
    await expect(s.init()).resolves.toBeUndefined();
  });
});

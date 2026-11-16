import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStorage, type Storage } from './client';

describe('PGlite storage', () => {
  let storage: Storage;

  beforeAll(async () => {
    storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
    await storage.init();
  });
  afterAll(() => storage.close());

  it('applies migrations idempotently', async () => {
    await expect(storage.init()).resolves.toBeUndefined();
    await expect(storage.init()).resolves.toBeUndefined();
  });

  it('round-trips a view with a JSONB spec', async () => {
    const spec = { widgets: [{ type: 'table', n: 1 }], nested: { a: [1, 2] } };
    const created = await storage.prisma.view.create({ data: { concept: 'Character', title: 'T', spec } });
    expect((await storage.prisma.view.findUnique({ where: { id: created.id } }))?.spec).toEqual(spec);
    const updated = await storage.prisma.view.update({
      where: { id: created.id },
      data: { title: 'T2', isDefault: true },
    });
    expect(updated).toMatchObject({ title: 'T2', isDefault: true });
    expect(await storage.prisma.view.findMany({ where: { concept: 'Character' } })).toHaveLength(1);
  });

  it('round-trips a preference', async () => {
    const value = { theme: 'dark', list: [1, 2] };
    await storage.prisma.preference.upsert({ where: { key: 'k' }, create: { key: 'k', value }, update: { value } });
    await storage.prisma.preference.upsert({ where: { key: 'k' }, create: { key: 'k', value }, update: { value: 'x' } });
    expect((await storage.prisma.preference.findUnique({ where: { key: 'k' } }))?.value).toBe('x');
  });
});

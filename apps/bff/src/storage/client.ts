import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '../generated/prisma/client';
import { acquireDirLock } from './lock';
import { applyMigrations } from './migrate';
import type { StorageMode } from './mode';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url));

export type Storage = {
  prisma: PrismaClient;
  /** Brings the schema up to date (PGlite only; Postgres is migrated with the prisma CLI). */
  init: () => Promise<void>;
  close: () => Promise<void>;
};

export function createStorage(mode: StorageMode): Storage {
  if (mode.kind === 'postgres') {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: mode.url }, { schema: mode.schema }),
    });
    return { prisma, init: async () => {}, close: () => prisma.$disconnect() };
  }
  // PrismaClient needs its adapter factory at construction, but the PGlite instance (which creates
  // the data dir and opens the database) is only built on first use, so importing this module stays
  // free of side effects. `init()` is the normal first use and also takes the single-process lock.
  let opened: Promise<PGlite> | undefined;
  let release: (() => void) | undefined;
  const open = () => {
    opened ??= (async () => {
      if (!mode.dataDir.startsWith('memory://')) release = acquireDirLock(mode.dataDir);
      try {
        const pg = new PGlite(mode.dataDir);
        await pg.waitReady;
        return pg;
      } catch (err) {
        release?.();
        release = undefined;
        throw err;
      }
    })();
    return opened;
  };
  const adapter = {
    provider: 'postgres' as const,
    adapterName: 'fluid-lazy-pglite',
    connect: async () => new PrismaPGlite(await open()).connect(),
  };
  const prisma = new PrismaClient({ adapter });
  return {
    prisma,
    init: async () => {
      await applyMigrations(await open(), MIGRATIONS_DIR);
    },
    close: async () => {
      await prisma.$disconnect();
      if (opened) {
        const pg = await opened.catch(() => undefined);
        await pg?.close();
      }
      release?.();
      release = undefined;
      opened = undefined;
    },
  };
}

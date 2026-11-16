import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '../generated/prisma/client';
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
  // `memory://` keeps everything in RAM (tests); otherwise the directory is created if missing.
  if (!mode.dataDir.startsWith('memory://')) mkdirSync(mode.dataDir, { recursive: true });
  const pg = new PGlite(mode.dataDir);
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return {
    prisma,
    init: async () => {
      await pg.waitReady;
      await applyMigrations(pg, MIGRATIONS_DIR);
    },
    close: async () => {
      await prisma.$disconnect();
      await pg.close();
    },
  };
}

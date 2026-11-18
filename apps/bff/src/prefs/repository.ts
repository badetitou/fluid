import type { Prisma, PrismaClient } from '../generated/prisma/client';

/** App preferences, a key → JSON value store. */
export interface PrefRepository {
  all(): Promise<Record<string, unknown>>;
  /** Writes every entry in one transaction. */
  putAll(entries: Record<string, unknown>): Promise<void>;
}

export function createPrefRepository(prisma: PrismaClient): PrefRepository {
  return {
    async all() {
      const rows = await prisma.preference.findMany();
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },
    async putAll(entries) {
      await prisma.$transaction(
        Object.entries(entries).map(([key, value]) =>
          prisma.preference.upsert({
            where: { key },
            create: { key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          }),
        ),
      );
    },
  };
}

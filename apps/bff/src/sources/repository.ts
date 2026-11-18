import type { PrismaClient } from '../generated/prisma/client';
import { isNotFound } from '../storage/errors';
import type { SourceRecord } from './model';

export interface SourceData {
  name: string;
  url: string;
  authKind: string;
  headerName: string | null;
  /** Already encrypted. */
  secret: string | null;
  oauthIssuer: string | null;
  oauthClientId: string | null;
  /** Already encrypted. */
  oauthClientSecret: string | null;
  oauthScopes: string | null;
  oauthResource: string | null;
}

/** Update data: `bumpAuthGeneration` invalidates in-flight token writes in the same statement. */
export type SourceUpdate = Partial<SourceData> & { bumpAuthGeneration?: boolean };

export interface SourceRepository {
  list(): Promise<SourceRecord[]>;
  get(id: string): Promise<SourceRecord | null>;
  create(data: SourceData): Promise<SourceRecord>;
  update(id: string, data: SourceUpdate): Promise<SourceRecord | null>;
  remove(id: string): Promise<boolean>;
}


export function createSourceRepository(prisma: PrismaClient): SourceRepository {
  return {
    list: () => prisma.sourceConfig.findMany({ orderBy: { createdAt: 'asc' } }),
    get: (id) => prisma.sourceConfig.findUnique({ where: { id } }),
    create: (data) => prisma.sourceConfig.create({ data }),
    async update(id, { bumpAuthGeneration, ...data }) {
      try {
        return await prisma.sourceConfig.update({
          where: { id },
          data: { ...data, ...(bumpAuthGeneration ? { authGeneration: { increment: 1 } } : {}) },
        });
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async remove(id) {
      try {
        await prisma.sourceConfig.delete({ where: { id } });
        return true;
      } catch (err) {
        if (isNotFound(err)) return false;
        throw err;
      }
    },
  };
}

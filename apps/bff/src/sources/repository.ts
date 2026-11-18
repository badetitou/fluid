import type { PrismaClient } from '../generated/prisma/client';
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

export interface SourceRepository {
  list(): Promise<SourceRecord[]>;
  get(id: string): Promise<SourceRecord | null>;
  create(data: SourceData): Promise<SourceRecord>;
  update(id: string, data: Partial<SourceData>): Promise<SourceRecord | null>;
  remove(id: string): Promise<boolean>;
}

/** Prisma's "record to update/delete not found"; any other failure must surface. */
export function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025';
}

export function createSourceRepository(prisma: PrismaClient): SourceRepository {
  return {
    list: () => prisma.sourceConfig.findMany({ orderBy: { createdAt: 'asc' } }),
    get: (id) => prisma.sourceConfig.findUnique({ where: { id } }),
    create: (data) => prisma.sourceConfig.create({ data }),
    async update(id, data) {
      try {
        return await prisma.sourceConfig.update({ where: { id }, data });
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

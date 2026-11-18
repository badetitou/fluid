import type { PrismaClient } from '../generated/prisma/client';
import type { SourceRecord } from './model';

export interface SourceData {
  name: string;
  url: string;
  authKind: string;
  headerName: string | null;
  /** Already encrypted. */
  secret: string | null;
}

export interface SourceRepository {
  list(): Promise<SourceRecord[]>;
  get(id: string): Promise<SourceRecord | null>;
  create(data: SourceData): Promise<SourceRecord>;
  update(id: string, data: Partial<SourceData>): Promise<SourceRecord | null>;
  remove(id: string): Promise<boolean>;
}

export function createSourceRepository(prisma: PrismaClient): SourceRepository {
  return {
    list: () => prisma.sourceConfig.findMany({ orderBy: { createdAt: 'asc' } }),
    get: (id) => prisma.sourceConfig.findUnique({ where: { id } }),
    create: (data) => prisma.sourceConfig.create({ data }),
    async update(id, data) {
      try {
        return await prisma.sourceConfig.update({ where: { id }, data });
      } catch {
        return null;
      }
    },
    async remove(id) {
      try {
        await prisma.sourceConfig.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };
}

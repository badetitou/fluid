import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { isNotFound } from '../storage/errors';
import type { ViewData, ViewRecord } from './model';

/** Saved views. At most one default view per concept: setting one clears the others in the same transaction. */
export interface ViewRepository {
  list(concept?: string): Promise<ViewRecord[]>;
  get(id: string): Promise<ViewRecord | null>;
  create(data: ViewData): Promise<ViewRecord>;
  /** `concept` is the one the view has after the update (for the default rule). */
  update(id: string, data: Partial<ViewData>, concept: string): Promise<ViewRecord | null>;
  remove(id: string): Promise<boolean>;
}

const json = (spec: unknown) => spec as Prisma.InputJsonValue;

export function createViewRepository(prisma: PrismaClient): ViewRepository {
  return {
    list: (concept) => prisma.view.findMany({ where: concept ? { concept } : undefined, orderBy: { createdAt: 'asc' } }),
    get: (id) => prisma.view.findUnique({ where: { id } }),
    create: (data) =>
      prisma.$transaction(async (tx) => {
        if (data.isDefault) await tx.view.updateMany({ where: { concept: data.concept }, data: { isDefault: false } });
        return tx.view.create({ data: { ...data, spec: json(data.spec) } });
      }),
    async update(id, data, concept) {
      try {
        return await prisma.$transaction(async (tx) => {
          if (data.isDefault) await tx.view.updateMany({ where: { concept }, data: { isDefault: false } });
          const { spec, ...rest } = data;
          return tx.view.update({ where: { id }, data: { ...rest, ...(spec !== undefined ? { spec: json(spec) } : {}) } });
        });
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async remove(id) {
      try {
        await prisma.view.delete({ where: { id } });
        return true;
      } catch (err) {
        if (isNotFound(err)) return false;
        throw err;
      }
    },
  };
}

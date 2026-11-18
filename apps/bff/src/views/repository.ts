import type { PrismaClient } from '../generated/prisma/client';

/** Read-only access to stored views (the only Prisma access of the run feature). */
export interface ViewReader {
  /** The stored spec, unvalidated; null when the view does not exist. */
  getSpec(id: string): Promise<unknown | null>;
}

export function createViewReader(prisma: PrismaClient): ViewReader {
  return {
    async getSpec(id) {
      const view = await prisma.view.findUnique({ where: { id }, select: { spec: true } });
      return view ? view.spec : null;
    },
  };
}

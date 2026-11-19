import type { PrismaClient } from '../generated/prisma/client';

/** Read-only access to stored views (the only Prisma access of the run feature). */
export interface ViewReader {
  /** The stored spec, unvalidated; `null` when the view does not exist (JSON null never is a valid spec). */
  getSpec(id: string): Promise<unknown>;
}

export function createViewReader(prisma: PrismaClient): ViewReader {
  return {
    async getSpec(id) {
      const view = await prisma.view.findUnique({ where: { id }, select: { spec: true } });
      return view ? view.spec : null;
    },
  };
}

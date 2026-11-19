import type { ViewSpec } from '@fluid/shared';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

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

export interface SavedViewRow {
  id: string;
  title: string;
  concept: string;
}

/** Stores new views (a draft saved from an MCP host). */
export interface ViewWriter {
  create(spec: ViewSpec): Promise<SavedViewRow>;
}

export function createViewWriter(prisma: PrismaClient): ViewWriter {
  return {
    create: (spec) =>
      prisma.view.create({
        data: { concept: spec.concept, title: spec.title, spec: spec as unknown as Prisma.InputJsonValue },
        select: { id: true, title: true, concept: true },
      }),
  };
}

/** A view action run, as the BFF keeps it. */
export interface ActionLogEntry {
  viewId: string;
  action: string;
  sourceId: string;
  variables: Record<string, unknown>;
  ok: boolean;
  result: unknown;
}

/** Where action runs are written down. */
export interface ActionLog {
  record(entry: ActionLogEntry): Promise<void>;
}

export function createActionLog(prisma: PrismaClient): ActionLog {
  return {
    async record(entry) {
      await prisma.actionLog.create({
        data: {
          ...entry,
          variables: entry.variables as Prisma.InputJsonValue,
          result: (entry.result ?? null) as Prisma.InputJsonValue,
        },
      });
    },
  };
}

import type { RawAnalysis } from './analysisSchema';

export interface CycleRow {
  /** Entities in the cycle. */
  size: number;
  /** The first ones, by name. */
  members: string[];
}

export interface EntityRow {
  key: string;
  name: string;
  kind: string;
  file: string | null;
}

export interface HubRow extends EntityRow {
  inDegree: number;
  outDegree: number;
}

export interface Architecture {
  cycleCount: number;
  cyclicEntities: number;
  cycles: CycleRow[];
  /** Entities with the highest fan-in plus fan-out. */
  hubs: HubRow[];
  /** Classes and methods nothing calls or references, and that call nothing (the first of each). */
  isolatedCount: number;
  isolated: EntityRow[];
}

const row = (e: { key: string; name: string; fineKind: string; file: string | null }): EntityRow => ({
  key: e.key,
  name: e.name,
  kind: e.fineKind,
  file: e.file,
});

/** The dashboard's architecture figures from Model's analysis, biggest cycles first. Pure. */
export function toArchitecture(raw: RawAnalysis): Architecture {
  return {
    cycleCount: raw.cycles.count,
    cyclicEntities: raw.cycles.cyclicEntities,
    cycles: raw.cycles.components
      .map((c) => ({ size: c.size, members: c.entities.map((e) => e.name) }))
      .sort((a, b) => b.size - a.size),
    hubs: raw.mostConnected.map((e) => ({ ...row(e), inDegree: e.inDegree, outDegree: e.outDegree })),
    isolatedCount: raw.isolatedClasses.totalCount + raw.isolatedMethods.totalCount,
    isolated: [...raw.isolatedClasses.nodes, ...raw.isolatedMethods.nodes].map(row),
  };
}

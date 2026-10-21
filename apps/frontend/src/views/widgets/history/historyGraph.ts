import type { HistoryNode } from './historyModel';

// Lane layout of the history graph, as in `git log --graph`. The versions are
// walked children first; each lane "waits" for the id of the next version it
// leads to. A version takes the lane waiting for it (or a free one: a branch
// tip), the lanes also waiting for it join it (branches forking from it), and
// its parents are handed over: the first one continues the lane, the others
// (merges) join the lane already waiting for them or open a new one.

/** A line of the graph within one row: `y` is 0 (top), 0.5 (the dot) or 1 (bottom). */
export interface Segment {
  fromLane: number;
  fromY: 0 | 0.5;
  toLane: number;
  toY: 0.5 | 1;
  color: number;
}

export interface GraphRow {
  node: HistoryNode;
  lane: number;
  /** Index into the palette. */
  color: number;
  segments: Segment[];
}

export interface HistoryGraph {
  rows: GraphRow[];
  /** Number of lanes used at the widest row. */
  laneCount: number;
}

interface Lane {
  /** Id of the version the lane leads to. */
  waitsFor: string;
  color: number;
}

const firstFree = (lanes: (Lane | null)[], skip?: number) => {
  const free = lanes.findIndex((l, i) => l === null && i !== skip);
  return free === -1 ? Math.max(lanes.length, (skip ?? -1) + 1) : free;
};

/** Lays out versions ordered children first (see `orderChildrenFirst`). */
export function buildGraph(nodes: HistoryNode[]): HistoryGraph {
  let lanes: (Lane | null)[] = [];
  let nextColor = 0;
  let laneCount = 0;
  const rows = nodes.map((node): GraphRow => {
    const before = lanes;
    const waiting = before.flatMap((l, i) => (l?.waitsFor === node.key ? [i] : []));
    const lane = waiting[0] ?? firstFree(before);
    const color = waiting.length ? before[lane]!.color : nextColor++;
    const segments: Segment[] = [];

    // Top half: lanes passing by, and lanes reaching the dot.
    before.forEach((l, i) => {
      if (!l) return;
      if (l.waitsFor === node.key) segments.push({ fromLane: i, fromY: 0, toLane: lane, toY: 0.5, color: l.color });
      else segments.push({ fromLane: i, fromY: 0, toLane: i, toY: 0.5, color: l.color });
    });

    const after = before.map((l) => (l?.waitsFor === node.key ? null : l));
    while (after.length <= lane) after.push(null);
    const [first, ...others] = node.parents;
    after[lane] = first === undefined ? null : { waitsFor: first, color };
    const mergeTargets: { lane: number; color: number }[] = [];
    for (const parent of others) {
      const existing = after.findIndex((l) => l?.waitsFor === parent);
      if (existing !== -1) {
        mergeTargets.push({ lane: existing, color: after[existing]!.color });
        continue;
      }
      const free = firstFree(after, lane);
      while (after.length <= free) after.push(null);
      after[free] = { waitsFor: parent, color: nextColor++ };
      mergeTargets.push({ lane: free, color: after[free]!.color });
    }

    // Bottom half: lanes going on, and lines from the dot to its parents' lanes.
    after.forEach((l, i) => {
      if (!l) return;
      const fromDot = i === lane || mergeTargets.some((t) => t.lane === i && before[i]?.waitsFor !== l.waitsFor);
      if (fromDot) segments.push({ fromLane: lane, fromY: 0.5, toLane: i, toY: 1, color: i === lane ? color : l.color });
      else segments.push({ fromLane: i, fromY: 0.5, toLane: i, toY: 1, color: l.color });
    });
    for (const t of mergeTargets) {
      // The parent already had a lane passing by: the merge line joins it at the bottom.
      if (before[t.lane]?.waitsFor === after[t.lane]?.waitsFor) {
        segments.push({ fromLane: lane, fromY: 0.5, toLane: t.lane, toY: 1, color: t.color });
      }
    }

    while (after.length && after[after.length - 1] === null) after.pop();
    laneCount = Math.max(laneCount, before.length, after.length, lane + 1);
    lanes = after;
    return { node, lane, color, segments };
  });
  return { rows, laneCount };
}

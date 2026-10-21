import { describe, expect, it } from 'vitest';
import type { HistoryNode } from './historyModel';
import { buildGraph, type GraphRow } from './historyGraph';

const node = (key: string, parents: string[] = []): HistoryNode => ({ key, parents, label: key, row: {}, refs: [] });
const lanes = (rows: GraphRow[]) => rows.map((r) => r.lane);
const lines = (row: GraphRow) => row.segments.map((s) => `${s.fromLane}@${s.fromY}->${s.toLane}@${s.toY}`).sort();

describe('buildGraph', () => {
  it('draws a linear history on one lane', () => {
    const graph = buildGraph([node('c', ['b']), node('b', ['a']), node('a')]);
    expect(lanes(graph.rows)).toEqual([0, 0, 0]);
    expect(graph.laneCount).toBe(1);
    expect(lines(graph.rows[0])).toEqual(['0@0.5->0@1']);
    expect(lines(graph.rows[1])).toEqual(['0@0->0@0.5', '0@0.5->0@1']);
    expect(lines(graph.rows[2])).toEqual(['0@0->0@0.5']);
  });

  it('opens a lane for a merged branch and closes it where it forked', () => {
    // m merges f into b; f and b both come from a.
    const graph = buildGraph([node('m', ['b', 'f']), node('f', ['a']), node('b', ['a']), node('a')]);
    const [m, f, b, a] = graph.rows;
    expect(lanes(graph.rows)).toEqual([0, 1, 0, 0]);
    expect(graph.laneCount).toBe(2);
    expect(lines(m)).toEqual(['0@0.5->0@1', '0@0.5->1@1']);
    expect(lines(f)).toEqual(['0@0->0@0.5', '0@0.5->0@1', '1@0->1@0.5', '1@0.5->1@1']);
    expect(lines(b)).toEqual(['0@0->0@0.5', '0@0.5->0@1', '1@0->1@0.5', '1@0.5->1@1']);
    // The fork: both lanes reach a.
    expect(lines(a)).toEqual(['0@0->0@0.5', '1@0->0@0.5']);
    expect(f.color).not.toBe(m.color);
    expect(b.color).toBe(m.color);
  });

  it('joins a merge line into a lane already waiting for that parent', () => {
    // t1 and t2 are two tips on top of p; m (on t1's lane) also merges p.
    const graph = buildGraph([node('t2', ['p']), node('m', ['q', 'p']), node('q', ['p']), node('p')]);
    const m = graph.rows[1];
    expect(m.lane).toBe(1);
    expect(lines(m)).toContain('1@0.5->0@1');
    expect(graph.laneCount).toBe(2);
  });

  it('gives each branch tip a new lane and color, reusing freed lanes', () => {
    const graph = buildGraph([node('x', ['r']), node('y', ['r']), node('r'), node('z')]);
    expect(lanes(graph.rows)).toEqual([0, 1, 0, 0]);
    expect(new Set(graph.rows.slice(0, 2).map((r) => r.color)).size).toBe(2);
    expect(lines(graph.rows[3])).toEqual([]);
  });

  it('keeps a lane going down for a parent missing from the list', () => {
    const graph = buildGraph([node('b', ['a'])]);
    expect(lines(graph.rows[0])).toEqual(['0@0.5->0@1']);
  });

  it('draws an octopus merge with one lane per extra parent', () => {
    const graph = buildGraph([node('o', ['a', 'b', 'c']), node('c'), node('b'), node('a')]);
    expect(lines(graph.rows[0])).toEqual(['0@0.5->0@1', '0@0.5->1@1', '0@0.5->2@1']);
    expect(graph.laneCount).toBe(3);
  });
});

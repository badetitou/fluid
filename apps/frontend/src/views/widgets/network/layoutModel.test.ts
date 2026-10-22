import { describe, expect, it } from 'vitest';
import {
  effectiveLayout,
  forceDuration,
  LAYERED_MAX_EDGES,
  LAYERED_MAX_NODES,
  layeredRequestSchema,
  layeredResponseSchema,
  seededPosition,
  seededPositions,
} from './layoutModel';
import { layeredPositions } from './layeredLayout';

describe('seeded positions', () => {
  it('places a node from its key and the seed only', () => {
    expect(seededPosition('a', 10)).toEqual(seededPosition('a', 10));
    expect(seededPosition('a', 10)).not.toEqual(seededPosition('b', 10));
    expect(seededPosition('a', 10, 2)).not.toEqual(seededPosition('a', 10, 1));
    expect(seededPositions(['a', 'b']).get('a')).toEqual(seededPositions(['b', 'a']).get('a'));
  });

  it('stays within the spread', () => {
    for (const key of ['x', 'y', 'z', 'long key']) {
      const { x, y } = seededPosition(key, 5);
      expect(Math.abs(x)).toBeLessThanOrEqual(5);
      expect(Math.abs(y)).toBeLessThanOrEqual(5);
    }
  });

  it('runs the force layout longer on bigger graphs, within bounds', () => {
    expect(forceDuration(10)).toBeLessThan(forceDuration(1000));
    expect(forceDuration(1_000_000)).toBe(6000);
  });
});

describe('effective layout', () => {
  it('keeps layers for graphs dagre handles quickly, forces beyond', () => {
    expect(effectiveLayout('layered', 100, 200)).toBe('layered');
    expect(effectiveLayout('layered', LAYERED_MAX_NODES + 1, 10)).toBe('force');
    expect(effectiveLayout('layered', 100, LAYERED_MAX_EDGES + 1)).toBe('force');
    expect(effectiveLayout('force', 10, 10)).toBe('force');
  });
});

describe('layered layout', () => {
  const request = {
    nodes: [
      { key: 'a', label: 'a' },
      { key: 'b', label: 'b' },
      { key: 'c', label: 'c' },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
    direction: 'TB' as const,
  };

  it('puts each node below the one it comes from (y grows upwards)', () => {
    const { positions } = layeredPositions(request);
    expect(positions.a.y).toBeGreaterThan(positions.b.y);
    expect(positions.b.y).toBeGreaterThan(positions.c.y);
  });

  it('lays out from left to right', () => {
    const { positions } = layeredPositions({ ...request, direction: 'LR' });
    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });

  it('validates the worker messages', () => {
    expect(layeredRequestSchema.safeParse(request).success).toBe(true);
    expect(layeredRequestSchema.safeParse({ ...request, direction: 'RL' }).success).toBe(false);
    expect(layeredResponseSchema.safeParse(layeredPositions(request)).success).toBe(true);
    expect(layeredResponseSchema.safeParse({ positions: { a: { x: 'no' } } }).success).toBe(false);
  });
});

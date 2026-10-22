import { z } from 'zod';

// Node placement, independent of the renderer: the deterministic starting
// position of every node, and the messages exchanged with the layered-layout
// worker (validated on both ends, like all data crossing a boundary).

export interface Point {
  x: number;
  y: number;
}

/** FNV-1a: a stable 32-bit hash of a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small seeded generator, so the same seed always draws the same numbers. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where a node starts, before the force layout moves it: drawn from its key and
 * `seed` only, so a node keeps its place whatever the other nodes (tests, focus).
 */
export function seededPosition(key: string, spread: number, seed = 1): Point {
  const next = random(hash(key) ^ seed);
  return { x: (next() * 2 - 1) * spread, y: (next() * 2 - 1) * spread };
}

/** The starting positions of `keys`, spread according to their number. */
export function seededPositions(keys: string[], seed = 1): Map<string, Point> {
  const spread = Math.max(10, Math.sqrt(keys.length) * 10);
  return new Map(keys.map((key) => [key, seededPosition(key, spread, seed)]));
}

export const layeredRequestSchema = z.object({
  nodes: z.array(z.object({ key: z.string(), label: z.string() })),
  edges: z.array(z.object({ source: z.string(), target: z.string() })),
  direction: z.enum(['TB', 'LR']),
});
export type LayeredRequest = z.infer<typeof layeredRequestSchema>;

export const layeredResponseSchema = z.object({
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
});
export type LayeredResponse = z.infer<typeof layeredResponseSchema>;

/** How long the force layout runs, in ms: longer for bigger graphs, within bounds. */
export const forceDuration = (order: number): number => Math.min(6000, 1500 + order * 2);

/**
 * Beyond these sizes dagre takes too long (about 3 s for 800 nodes and 2,300 edges of a
 * real call graph, minutes for 2,600 nodes): the whole graph is laid out by forces and
 * the layers wait for a focus on a node.
 */
export const LAYERED_MAX_NODES = 600;
export const LAYERED_MAX_EDGES = 1500;

/** The layout actually run for a graph of `order` nodes and `size` edges. */
export function effectiveLayout(requested: 'force' | 'layered', order: number, size: number): 'force' | 'layered' {
  return requested === 'layered' && (order > LAYERED_MAX_NODES || size > LAYERED_MAX_EDGES) ? 'force' : requested;
}

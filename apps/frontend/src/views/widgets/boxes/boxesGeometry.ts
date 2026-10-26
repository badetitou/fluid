import type { BoxesModel, BoxesOptions, BoxItem } from './boxesModel';

// Shared geometry of the boxes layouts: what they produce, how big a box is
// from its metrics, and how blocks are packed in rows.

export interface PlacedBox {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Large enough to print its label inside. */
  labelled: boolean;
  /** Treemap: a box holding its children (its label sits in a header strip). */
  container?: boolean;
}

/** A titled frame around the boxes of a group. */
export interface Frame {
  key: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A parent → child connector, as an SVG path. */
export interface Edge {
  key: string;
  d: string;
}

export interface BoxesLayout {
  boxes: PlacedBox[];
  frames: Frame[];
  edges: Edge[];
  width: number;
  height: number;
}

export interface Size {
  w: number;
  h: number;
}

export const MIN_SIDE = 6;
export const MAX_SIDE = 96;
export const FIXED_SIDE = 20;
/** Margin around the whole drawing. */
export const PAD = 12;
export const GAP = 6;
/** Height of a frame's (or a treemap container's) title strip. */
export const HEADER = 18;

const scale = (value: number | undefined, max: number) =>
  max > 0 ? MIN_SIDE + (Math.max(value ?? 0, 0) / max) * (MAX_SIDE - MIN_SIDE) : MIN_SIDE;

const maxOf = (items: BoxItem[], pick: (i: BoxItem) => number | undefined) =>
  items.reduce((m, i) => Math.max(m, pick(i) ?? 0), 0);

/**
 * The size of each box: width and height scaled linearly from their metrics (0 → `MIN_SIDE`, the largest
 * value → `MAX_SIDE`), `FIXED_SIDE` without metric; a square of area ∝ `sizeField` when only that is set.
 */
export function boxSizes(model: BoxesModel, opts: Pick<BoxesOptions, 'widthField' | 'heightField' | 'sizeField'>): Map<string, Size> {
  const items = [...model.items.values()];
  const maxW = maxOf(items, (i) => i.width);
  const maxH = maxOf(items, (i) => i.height);
  const maxS = maxOf(items, (i) => i.size);
  const squares = !opts.widthField && !opts.heightField && opts.sizeField !== undefined;
  const sizes = new Map<string, Size>();
  for (const item of items) {
    if (squares) {
      const side = maxS > 0 ? MIN_SIDE + Math.sqrt(Math.max(item.size ?? 0, 0) / maxS) * (MAX_SIDE - MIN_SIDE) : MIN_SIDE;
      sizes.set(item.key, { w: side, h: side });
      continue;
    }
    sizes.set(item.key, {
      w: opts.widthField ? scale(item.width, maxW) : FIXED_SIDE,
      h: opts.heightField ? scale(item.height, maxH) : FIXED_SIDE,
    });
  }
  return sizes;
}

/** Whether a label fits in a box of this size. */
export const fitsLabel = (w: number, h: number) => w >= 44 && h >= 14;

export interface Packing {
  positions: { x: number; y: number }[];
  width: number;
  height: number;
}

/** Places blocks left to right, wrapping to a new row past `maxWidth` (a block wider than it gets its own row). */
export function packRows(blocks: Size[], maxWidth: number, gap = GAP): Packing {
  const positions: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;
  for (const block of blocks) {
    if (x > 0 && x + block.w > maxWidth) {
      y += rowHeight + gap;
      x = 0;
      rowHeight = 0;
    }
    positions.push({ x, y });
    width = Math.max(width, x + block.w);
    rowHeight = Math.max(rowHeight, block.h);
    x += block.w + gap;
  }
  return { positions, width, height: blocks.length ? y + rowHeight : 0 };
}

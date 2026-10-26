import type { BoxesModel } from './boxesModel';
import { fitsLabel, GAP, HEADER, packRows, PAD, type BoxesLayout, type Frame, type PlacedBox, type Size } from './boxesGeometry';

// The `flow` layout: boxes left to right, wrapping at the available width; with
// groups, one titled frame per group (distribution map), the frames flowing too.

const FRAME_PAD = 6;
/** Title of the frame of boxes without group. */
export const NO_GROUP = '(no group)';

/** Boxes of `keys` flowing from (x, y) within `maxWidth`. */
function flowBoxes(keys: string[], sizes: ReadonlyMap<string, Size>, maxWidth: number, x: number, y: number) {
  const blocks = keys.map((k) => sizes.get(k)!);
  const packing = packRows(blocks, maxWidth);
  const boxes: PlacedBox[] = keys.map((key, i) => {
    const { w, h } = blocks[i];
    return { key, x: x + packing.positions[i].x, y: y + packing.positions[i].y, w, h, labelled: fitsLabel(w, h) };
  });
  return { boxes, width: packing.width, height: packing.height };
}

/** The keys of each group, the most populated group first, boxes without group last. */
function groupMembers(model: BoxesModel): [string, string[]][] {
  const members = new Map<string, string[]>(model.groups.map((g) => [g, []]));
  const loose: string[] = [];
  for (const key of model.order) {
    const group = model.items.get(key)!.group;
    if (group === undefined) loose.push(key);
    else members.get(group)!.push(key);
  }
  const out = [...members.entries()];
  if (loose.length) out.push([NO_GROUP, loose]);
  return out;
}

/** A frame's inner width: roughly square, never narrower than its widest box nor wider than the view. */
function innerWidth(keys: string[], sizes: ReadonlyMap<string, Size>, maxWidth: number): number {
  let area = 0;
  let widest = 0;
  for (const key of keys) {
    const { w, h } = sizes.get(key)!;
    area += (w + GAP) * (h + GAP);
    widest = Math.max(widest, w);
  }
  return Math.min(Math.max(Math.sqrt(area) * 1.4, widest, 80), maxWidth);
}

/** Lays the boxes out in rows, in titled frames per group when the boxes have groups. */
export function flowLayout(model: BoxesModel, sizes: ReadonlyMap<string, Size>, viewWidth: number): BoxesLayout {
  const maxWidth = Math.max(viewWidth - 2 * PAD, 120);
  if (model.groups.length === 0) {
    const flow = flowBoxes(model.order, sizes, maxWidth, PAD, PAD);
    return { boxes: flow.boxes, frames: [], edges: [], width: flow.width + 2 * PAD, height: flow.height + 2 * PAD };
  }
  const blocks = groupMembers(model).map(([title, keys]) => {
    const flow = flowBoxes(keys, sizes, innerWidth(keys, sizes, maxWidth - 2 * FRAME_PAD), 0, 0);
    return { title, flow, w: Math.max(flow.width, 60) + 2 * FRAME_PAD, h: HEADER + flow.height + 2 * FRAME_PAD };
  });
  const packing = packRows(blocks, maxWidth, GAP * 2);
  const frames: Frame[] = [];
  const boxes: PlacedBox[] = [];
  blocks.forEach((block, i) => {
    const x = PAD + packing.positions[i].x;
    const y = PAD + packing.positions[i].y;
    frames.push({ key: block.title, title: block.title, x, y, w: block.w, h: block.h });
    const dx = x + FRAME_PAD;
    const dy = y + HEADER + FRAME_PAD;
    for (const b of block.flow.boxes) boxes.push({ ...b, x: b.x + dx, y: b.y + dy });
  });
  return { boxes, frames, edges: [], width: packing.width + 2 * PAD, height: packing.height + 2 * PAD };
}

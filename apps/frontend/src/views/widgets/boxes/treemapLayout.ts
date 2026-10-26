import type { BoxesModel, BoxItem } from './boxesModel';
import { fitsLabel, HEADER, type BoxesLayout, type Frame, type PlacedBox } from './boxesGeometry';
import { NO_GROUP } from './flowLayout';

// The `treemap` layout (Nesting): the view's rectangle split in proportion to
// `sizeField`, squarified; groups are titled frames holding their boxes, a box
// with children holds them below its title strip.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Node {
  key: string;
  group?: string;
  value: number;
  children: Node[];
}

const INSET = 2;
/** The smallest share of its parent a box gets, so that a zero-sized box stays visible. */
const MIN_SHARE = 0.002;

const worst = (areas: number[], side: number) => {
  const sum = areas.reduce((s, a) => s + a, 0);
  return Math.max((side * side * Math.max(...areas)) / (sum * sum), (sum * sum) / (side * side * Math.min(...areas)));
};

/** Splits `rect` into one rectangle per value, areas proportional, as square as possible (input order kept). */
export function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  const floor = total > 0 ? total * MIN_SHARE : 1;
  const shares = values.map((v) => Math.max(v, 0) + floor);
  const sum = shares.reduce((s, v) => s + v, 0);
  const areas = shares.map((v) => (v / sum) * rect.w * rect.h);
  const order = areas.map((_, i) => i).sort((a, b) => areas[b] - areas[a]);
  const out: Rect[] = new Array(values.length);
  let { x, y, w, h } = rect;
  const flush = (row: number[]) => {
    const rowArea = row.reduce((s, i) => s + areas[i], 0);
    if (w >= h) {
      const t = h > 0 ? rowArea / h : 0;
      let at = y;
      for (const i of row) {
        const side = t > 0 ? areas[i] / t : 0;
        out[i] = { x, y: at, w: t, h: side };
        at += side;
      }
      x += t;
      w -= t;
    } else {
      const t = w > 0 ? rowArea / w : 0;
      let at = x;
      for (const i of row) {
        const side = t > 0 ? areas[i] / t : 0;
        out[i] = { x: at, y, w: side, h: t };
        at += side;
      }
      y += t;
      h -= t;
    }
  };
  let row: number[] = [];
  for (const i of order) {
    const side = Math.min(w, h);
    const current = row.map((r) => areas[r]);
    if (row.length === 0 || worst([...current, areas[i]], side) <= worst(current, side)) row.push(i);
    else {
      flush(row);
      row = [i];
    }
  }
  if (row.length) flush(row);
  return out;
}

/** The nodes of the treemap: groups (if any) holding hierarchies of boxes, each worth its size plus its children's. */
function buildNodes(model: BoxesModel, sized: boolean): Node[] {
  const boxNode = (item: BoxItem): Node => {
    const children = item.children.map((c) => boxNode(model.items.get(c)!));
    const own = sized ? Math.max(item.size ?? 0, 0) : 1;
    return { key: item.key, value: own + children.reduce((s, c) => s + c.value, 0), children };
  };
  const roots = model.order.filter((k) => model.items.get(k)!.parent === undefined).map((k) => boxNode(model.items.get(k)!));
  if (model.groups.length === 0) return roots;
  const groups = new Map<string, Node>();
  for (const root of roots) {
    const title = model.items.get(root.key)!.group ?? NO_GROUP;
    const group = groups.get(title) ?? { key: `group:${title}`, group: title, value: 0, children: [] };
    group.value += root.value;
    group.children.push(root);
    groups.set(title, group);
  }
  return [...groups.values()].sort((a, b) => b.value - a.value);
}

/** The area left to a container's children: below its title strip, inset. */
function innerRect(r: Rect): Rect | null {
  const header = r.h > HEADER * 2 && r.w > 30 ? HEADER : INSET;
  const inner = { x: r.x + INSET, y: r.y + header, w: r.w - 2 * INSET, h: r.h - header - INSET };
  return inner.w > 4 && inner.h > 4 ? inner : null;
}

/** Fills a `width` × `height` rectangle with the boxes, areas from `sizeField` (equal without it). */
export function treemapLayout(model: BoxesModel, sized: boolean, width: number, height: number): BoxesLayout {
  const boxes: PlacedBox[] = [];
  const frames: Frame[] = [];
  const place = (nodes: Node[], rect: Rect) => {
    const rects = squarify(
      nodes.map((n) => n.value),
      rect,
    );
    nodes.forEach((node, i) => {
      const r = rects[i];
      const container = node.children.length > 0;
      if (node.group !== undefined) frames.push({ key: node.key, title: node.group, ...r });
      else boxes.push({ key: node.key, ...r, labelled: fitsLabel(r.w, r.h), container });
      const inner = container ? innerRect(r) : null;
      if (inner) place(node.children, inner);
    });
  };
  place(buildNodes(model, sized), { x: 0, y: 0, w: width, h: height });
  return { boxes, frames, edges: [], width, height };
}

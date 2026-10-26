import type { BoxesModel } from './boxesModel';
import { fitsLabel, GAP, packRows, PAD, type BoxesLayout, type Edge, type PlacedBox, type Size } from './boxesGeometry';

// The `tree` layout (System Complexity): each box centered above its children,
// boxes of a level top-aligned, orthogonal parent → child edges. Hierarchies
// are laid out one by one, then flow in rows: the largest first, lone boxes last.

const LEVEL_GAP = 28;

/** An orthogonal connector: down from the parent, along the bus, down to the child. */
interface Connector {
  key: string;
  x1: number;
  y1: number;
  bus: number;
  x2: number;
  y2: number;
}

interface Tree {
  boxes: PlacedBox[];
  edges: Connector[];
  width: number;
  height: number;
}

/** Lays out the hierarchy under `root`, from (0, 0). */
function layoutTree(model: BoxesModel, sizes: ReadonlyMap<string, Size>, root: string): Tree {
  const levelHeights: number[] = [];
  const spans = new Map<string, number>();
  const measure = (key: string, depth: number): number => {
    const { w, h } = sizes.get(key)!;
    levelHeights[depth] = Math.max(levelHeights[depth] ?? 0, h);
    const children = model.items.get(key)!.children;
    const below = children.reduce((sum, c) => sum + measure(c, depth + 1), 0) + GAP * Math.max(children.length - 1, 0);
    const span = Math.max(w, below);
    spans.set(key, span);
    return span;
  };
  const width = measure(root, 0);
  const levelTops = levelHeights.map((_, d) => levelHeights.slice(0, d).reduce((y, h) => y + h + LEVEL_GAP, 0));

  const boxes: PlacedBox[] = [];
  const edges: Connector[] = [];
  const place = (key: string, left: number, depth: number) => {
    const { w, h } = sizes.get(key)!;
    const span = spans.get(key)!;
    const cx = left + span / 2;
    const y = levelTops[depth];
    boxes.push({ key, x: cx - w / 2, y, w, h, labelled: fitsLabel(w, h) });
    const children = model.items.get(key)!.children;
    const below = children.reduce((sum, c) => sum + spans.get(c)!, 0) + GAP * Math.max(children.length - 1, 0);
    let at = left + (span - below) / 2;
    const childTop = levelTops[depth + 1];
    const busY = childTop - LEVEL_GAP / 2;
    for (const child of children) {
      const childCx = at + spans.get(child)! / 2;
      edges.push({ key: `${key}>${child}`, x1: cx, y1: y + h, bus: busY, x2: childCx, y2: childTop });
      place(child, at, depth + 1);
      at += spans.get(child)! + GAP;
    }
  };
  place(root, 0, 0);
  const height = levelTops[levelTops.length - 1] + levelHeights[levelHeights.length - 1];
  return { boxes, edges, width, height };
}

/** Lays every hierarchy out, then flows them in rows within the view's width. */
export function treeLayout(model: BoxesModel, sizes: ReadonlyMap<string, Size>, viewWidth: number): BoxesLayout {
  const roots = [...model.roots].sort((a, b) => {
    const lone = (k: string) => (model.items.get(k)!.children.length === 0 ? 1 : 0);
    return lone(a) - lone(b);
  });
  const trees = roots.map((root) => layoutTree(model, sizes, root));
  const widest = trees.reduce((m, t) => Math.max(m, t.width), 0);
  const packing = packRows(trees.map((t) => ({ w: t.width, h: t.height })), Math.max(viewWidth - 2 * PAD, widest), GAP * 3);
  const boxes: PlacedBox[] = [];
  const edges: Edge[] = [];
  trees.forEach((tree, i) => {
    const dx = PAD + packing.positions[i].x;
    const dy = PAD + packing.positions[i].y;
    for (const b of tree.boxes) boxes.push({ ...b, x: b.x + dx, y: b.y + dy });
    for (const e of tree.edges) {
      edges.push({ key: e.key, d: `M${e.x1 + dx},${e.y1 + dy}V${e.bus + dy}H${e.x2 + dx}V${e.y2 + dy}` });
    }
  });
  return { boxes, frames: [], edges, width: packing.width + 2 * PAD, height: packing.height + 2 * PAD };
}

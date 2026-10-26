import { CENTER_ID, type Butterfly } from './butterflyModel';

// Where each box of the butterfly map goes: columns from the outer dependents
// (left) to the outer dependencies (right), the center in the middle, each
// column centered vertically; edges as curves from a box's right side to the
// next box's left side.

export const BOX = { height: 24, centerHeight: 36, gap: 6, padding: 12, minColumn: 110, columnGap: 48, charWidth: 7 };

export interface PlacedBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedEdge {
  key: string;
  source: string;
  target: string;
  path: string;
  strokeWidth: number;
}

export interface ButterflyLayout {
  width: number;
  height: number;
  boxes: Map<string, PlacedBox>;
  edges: PlacedEdge[];
  /** Characters of a label that fit in a box. */
  maxChars: number;
}

/** Stroke width of an edge: 1 for a single link, growing slowly with repeated links. */
export const strokeWidth = (weight: number): number => Math.min(1 + Math.log2(Math.max(weight, 1)) * 1.5, 7);

/** A label cut to `max` characters, with an ellipsis. */
export function truncate(label: string, max: number): string {
  return label.length <= max ? label : `${label.slice(0, Math.max(max - 1, 1))}…`;
}

/** The ids of each column, left to right: outer dependents, dependents, center, dependencies, outer ones. */
export function columnsOf(butterfly: Butterfly): string[][] {
  const pick = (side: 'in' | 'out', level: 1 | 2) =>
    butterfly.nodes.filter((n) => n.side === side && n.level === level).map((n) => n.id);
  const deep = butterfly.nodes.some((n) => n.level === 2);
  const columns = [pick('in', 1), [CENTER_ID], pick('out', 1)];
  return deep ? [pick('in', 2), ...columns, pick('out', 2)] : columns;
}

const columnHeight = (ids: string[]) =>
  ids.reduce((h, id) => h + (id === CENTER_ID ? BOX.centerHeight : BOX.height), 0) + Math.max(ids.length - 1, 0) * BOX.gap;

/** Lays the map out in `width` pixels (wider when the columns would be too narrow). */
export function layoutButterfly(butterfly: Butterfly, availableWidth: number): ButterflyLayout {
  const columns = columnsOf(butterfly);
  const gaps = (columns.length - 1) * BOX.columnGap + 2 * BOX.padding;
  const columnWidth = Math.max(BOX.minColumn, Math.floor((availableWidth - gaps) / columns.length));
  const width = columnWidth * columns.length + gaps;
  const height = Math.max(...columns.map(columnHeight)) + 2 * BOX.padding;

  const boxes = new Map<string, PlacedBox>();
  columns.forEach((ids, c) => {
    const x = BOX.padding + c * (columnWidth + BOX.columnGap);
    let y = (height - columnHeight(ids)) / 2;
    for (const id of ids) {
      const h = id === CENTER_ID ? BOX.centerHeight : BOX.height;
      boxes.set(id, { id, x, y, width: columnWidth, height: h });
      y += h + BOX.gap;
    }
  });

  const edges = butterfly.edges.flatMap((edge): PlacedEdge[] => {
    const from = boxes.get(edge.source);
    const to = boxes.get(edge.target);
    if (!from || !to) return [];
    const [x1, y1] = [from.x + from.width, from.y + from.height / 2];
    const [x2, y2] = [to.x, to.y + to.height / 2];
    const mx = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    return [{ key: edge.key, source: edge.source, target: edge.target, path, strokeWidth: strokeWidth(edge.weight) }];
  });

  return { width, height, boxes, edges, maxChars: Math.max(Math.floor((columnWidth - 16) / BOX.charWidth), 4) };
}

import type { GraphExplorerWidget } from '@fluid/shared';
import { canExpand } from './graphExplorerModel';
import type { Bounds, HierarchyDraft, HierarchyNode } from './hierarchyModel';

// Deterministic packed layout: children sit in bounded rows inside their parent
// box. No simulation, so thousands of nodes cost one linear pass.

interface Size {
  width: number;
  height: number;
}

const LEAF: Size = { width: 150, height: 42 };
const PADDING = 22;
const HEADER = 28;
const GAP = 12;

const chunk = <T,>(values: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < values.length; i += size) rows.push([...values.slice(i, i + size)]);
  return rows;
};

/** Measures and places every visible node, bottom-up then top-down. */
export function layoutHierarchy(
  drafts: ReadonlyMap<string, HierarchyDraft>,
  visible: ReadonlySet<string>,
  open: ReadonlySet<string>,
  widget: GraphExplorerWidget,
): { nodes: HierarchyNode[]; bounds: Bounds } {
  const columns = widget.direction === 'LR' ? 2 : 4;
  const measured = new Map<string, Size>();
  const measure = (key: string): Size => {
    const cached = measured.get(key);
    if (cached) return cached;
    const draft = drafts.get(key);
    if (!draft) return LEAF;
    if (draft.kind === 'leaf') {
      const size =
        open.has(key) && canExpand(widget, draft.row)
          ? { width: 360, height: Math.max(220, 120 + (widget.widgets?.length ?? 0) * 90) }
          : LEAF;
      measured.set(key, size);
      return size;
    }
    const rows = chunk(draft.children.filter((child) => visible.has(child)), columns).map((row) =>
      row.map((child) => measure(child)),
    );
    const size = {
      width: Math.max(0, ...rows.map((row) => row.reduce((sum, s) => sum + s.width + GAP, -GAP))) + PADDING * 2,
      height: HEADER + PADDING + rows.reduce((sum, row) => sum + Math.max(...row.map((s) => s.height)) + GAP, -GAP),
    };
    measured.set(key, size);
    return size;
  };

  const nodes: HierarchyNode[] = [];
  const place = (key: string, x: number, y: number): void => {
    const draft = drafts.get(key);
    if (!draft || !visible.has(key)) return;
    nodes.push({
      ...draft,
      ...measure(key),
      x,
      y,
      expandable:
        draft.kind === 'leaf' ? canExpand(widget, draft.row) : draft.children.some((child) => visible.has(child)),
    });
    if (draft.kind === 'leaf') return;
    let top = y + HEADER + PADDING;
    for (const row of chunk(draft.children.filter((child) => visible.has(child)), columns)) {
      const heights = row.map((child) => measure(child).height);
      const rowHeight = Math.max(...heights);
      let left = x + PADDING;
      row.forEach((child, index) => {
        place(child, left, top + (rowHeight - heights[index]) / 2);
        left += measure(child).width + GAP;
      });
      top += rowHeight + GAP;
    }
  };
  place('h:root', 0, 0);

  const bounds: Bounds = {
    minX: Math.min(...nodes.map((node) => node.x)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height)),
  };
  return {
    nodes,
    bounds: nodes.length ? bounds : { minX: 0, minY: 0, maxX: LEAF.width, maxY: LEAF.height },
  };
}

import { GRID_COLUMNS, type Widget, type WidgetLayout } from '@fluid/shared';

// -----------------------------------------------------------------------------
// Widget layout grid
// -----------------------------------------------------------------------------
// Widgets arranged with the mouse sit on a GRID_COLUMNS-wide grid of fixed-height
// rows, like widgets on a macOS desktop: they snap to cells, stay where they are
// dropped and never overlap — whatever is in the way is pushed down. Everything
// here is pure so it can be unit tested.
// -----------------------------------------------------------------------------

/** Pixel height of one grid row. */
export const ROW_HEIGHT = 32;
/** Pixel gap between cells, both ways. */
export const GRID_GAP = 12;
/** Smallest height a widget can be resized to, in rows. */
export const MIN_ROWS = 2;

export interface Box extends WidgetLayout {
  id: string;
}

/** Quick sizes offered on a widget's context menu (columns × rows). */
export const SIZE_PRESETS = [
  { key: 'small', label: 'Small', w: 3, h: 4 },
  { key: 'medium', label: 'Medium', w: 6, h: 4 },
  { key: 'large', label: 'Large', w: 6, h: 8 },
  { key: 'wide', label: 'Extra large', w: 12, h: 8 },
] as const;

/** Rows needed to hold `px` pixels of content. */
export function rowsFor(px: number): number {
  return Math.max(MIN_ROWS, Math.ceil((px + GRID_GAP) / (ROW_HEIGHT + GRID_GAP)));
}

/** Pixel extent of `cells` grid cells of size `cell`, gaps between them included. */
export function cellsToPx(cells: number, cell: number): number {
  return cells * cell + Math.max(0, cells - 1) * GRID_GAP;
}

// Card header + body padding wrapped around a widget's content.
const CARD_CHROME = 62;

/** A sensible size for a widget that was never placed by hand. */
export function defaultSize(widget: Widget): { w: number; h: number } {
  const w = Math.min(GRID_COLUMNS, Math.max(1, Math.round((widget.span ?? 24) / 2)));
  switch (widget.type) {
    case 'statistic':
      return { w, h: 3 };
    case 'table':
      return { w, h: 8 };
    case 'descriptions': {
      const lines = Math.ceil(widget.items.length / (widget.columns ?? 2));
      return { w, h: rowsFor(lines * 36 + CARD_CHROME) };
    }
    default:
      return { w, h: rowsFor((widget.height ?? 260) + CARD_CHROME) };
  }
}

export function collides(a: WidgetLayout, b: WidgetLayout): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const byPosition = (a: Box, b: Box) => a.y - b.y || a.x - b.x;

/** Keeps a box inside the grid's columns. */
export function clampBox(box: Box): Box {
  const w = Math.min(GRID_COLUMNS, Math.max(1, box.w));
  return {
    ...box,
    w,
    h: Math.max(MIN_ROWS, box.h),
    x: Math.min(GRID_COLUMNS - w, Math.max(0, box.x)),
    y: Math.max(0, box.y),
  };
}

/** First free row for `box` at its column, starting from `fromY` downwards. */
function dropAt(box: Box, placed: Box[], fromY = box.y): Box {
  let y = fromY;
  while (placed.some((p) => collides(p, { ...box, y }))) y++;
  return { ...box, y };
}

/** Removes overlaps, in reading order, by pushing boxes down. */
export function settle(boxes: Box[]): Box[] {
  const placed: Box[] = [];
  for (const box of [...boxes].sort(byPosition)) placed.push(dropAt(box, placed));
  return placed;
}

/** "Tidy up": lets every box rise as far as it can, closing the gaps. */
export function compact(boxes: Box[]): Box[] {
  const placed: Box[] = [];
  for (const box of [...boxes].sort(byPosition)) placed.push(dropAt(box, placed, 0));
  return placed;
}

/**
 * Places `pinned` (the box being dragged or resized) at its exact cell and
 * pushes whatever it lands on further down. When `vacated`
 * is given (the dragged box's former cell), the first box displaced by the drop
 * takes that cell instead, so dragging onto a neighbour swaps the two.
 */
export function placeBox(boxes: Box[], pinned: Box, vacated?: WidgetLayout): Box[] {
  const target = clampBox(pinned);
  const placed: Box[] = [target];
  let swapSlot = vacated;
  for (const box of boxes.filter((b) => b.id !== target.id).sort(byPosition)) {
    if (swapSlot && collides(box, target)) {
      const swapped = { ...box, x: swapSlot.x, y: swapSlot.y };
      swapSlot = undefined;
      if (swapped.x + swapped.w <= GRID_COLUMNS && !placed.some((p) => collides(p, swapped))) {
        placed.push(swapped);
        continue;
      }
    }
    placed.push(dropAt(box, placed));
  }
  return placed;
}

/**
 * Grid boxes for a view's widgets. Widgets placed by hand keep their cell;
 * the others flow below them, left to right, like the span-based layout did.
 */
export function resolveLayout(widgets: Widget[]): Box[] {
  const fixed = widgets.filter((w) => w.layout).map((w) => clampBox({ id: w.id, ...w.layout! }));
  let x = 0;
  let y = fixed.reduce((bottom, b) => Math.max(bottom, b.y + b.h), 0);
  let lineHeight = 0;
  const flowed: Box[] = [];
  for (const widget of widgets.filter((w) => !w.layout)) {
    const size = defaultSize(widget);
    if (x + size.w > GRID_COLUMNS) {
      x = 0;
      y += lineHeight;
      lineHeight = 0;
    }
    flowed.push({ id: widget.id, x, y, ...size });
    x += size.w;
    lineHeight = Math.max(lineHeight, size.h);
  }
  return settle([...fixed, ...flowed]);
}

/** Writes grid boxes back onto their widgets (widgets without a box are dropped). */
export function applyLayout(widgets: Widget[], boxes: Box[]): Widget[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  return widgets.flatMap((widget) => {
    const box = byId.get(widget.id);
    return box ? [{ ...widget, layout: { x: box.x, y: box.y, w: box.w, h: box.h } }] : [];
  });
}

/** Number of rows the boxes take up. */
export function gridRows(boxes: Box[]): number {
  return boxes.reduce((bottom, b) => Math.max(bottom, b.y + b.h), 0);
}

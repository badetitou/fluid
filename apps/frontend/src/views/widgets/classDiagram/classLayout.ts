import type { ClassForest, UmlClass } from './classDiagramModel';

// Pure layout of the class diagram: where each visible class box goes and the
// inheritance lines between them. Superclasses on top, centred over their
// subclasses; a class with many subclasses stacks them in columns hanging from
// a spine, so hundreds of siblings do not make one endless row.

/** Sizes shared with the CSS module (ClassDiagram.module.css): keep both in sync. */
export const BOX = {
  width: 200,
  line: 18,
  /** Vertical padding of a compartment. */
  padding: 4,
  /** An empty compartment. */
  empty: 8,
  /** The fold/unfold bar of a class with subclasses. */
  toggle: 22,
} as const;

const GAP_X = 24;
const GAP_Y = 48;
const STACK_GAP = 12;
/** Room left of a stacked column for its spine. */
const INDENT = 24;
const SPINE = 8;
/** Height of the inheritance triangle under a superclass. */
export const ARROW = 10;
/** Subclasses beyond which they are stacked in columns. */
const ROW_LIMIT = 4;
const MARGIN = 16;

export interface BoxContent {
  maxMembers: number;
  attributes: boolean;
  methods: boolean;
  group: boolean;
}

/** Lines of a compartment listing `count` members: at most `max`, then "+N more". */
export const shownMembers = (count: number, max: number) => (count > max ? max + 1 : count);

const compartment = (lines: number) => (lines === 0 ? BOX.empty : lines * BOX.line + 2 * BOX.padding) + 1;

/** The height of a class box, in pixels, given what it shows. */
export function boxHeight(cls: UmlClass, content: BoxContent): number {
  const header = 1 + (cls.abstract ? 1 : 0) + (content.group && cls.group ? 1 : 0) + (cls.others.length ? 1 : 0);
  let height = 2 + header * BOX.line + 2 * BOX.padding;
  if (content.maxMembers > 0 && content.attributes) height += compartment(shownMembers(cls.attributes.length, content.maxMembers));
  if (content.maxMembers > 0 && content.methods) height += compartment(shownMembers(cls.methods.length, content.maxMembers));
  return height + (cls.children.length ? BOX.toggle : 0);
}

export interface PlacedClass {
  key: string;
  x: number;
  y: number;
  height: number;
}
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface DiagramLayout {
  boxes: PlacedClass[];
  lines: Segment[];
  /** Tips of the inheritance triangles (bottom centre of a superclass). */
  arrows: { x: number; y: number }[];
  width: number;
  height: number;
}

/** A subtree laid out relative to its top-left corner. */
interface Arranged {
  width: number;
  height: number;
  /** Horizontal centre of the subtree's root box. */
  anchor: number;
  kids: { key: string; dx: number; dy: number }[];
  lines: Segment[];
}

const hLine = (y: number, xs: number[]): Segment => ({ x1: Math.min(...xs), y1: y, x2: Math.max(...xs), y2: y });
const vLine = (x: number, y1: number, y2: number): Segment => ({ x1: x, y1, x2: x, y2 });

/** Columns of a stack: about as many as rows, filled one after the other. */
function columnsOf(keys: string[]): string[][] {
  const rows = Math.ceil(keys.length / Math.ceil(Math.sqrt(keys.length)));
  const columns: string[][] = [];
  for (let i = 0; i < keys.length; i += rows) columns.push(keys.slice(i, i + rows));
  return columns;
}

/** Lays out the classes shown: the roots side by side, the subclasses of each unfolded class below it. */
export function layoutForest(
  forest: ClassForest,
  expanded: ReadonlySet<string>,
  heightOf: (cls: UmlClass) => number,
): DiagramLayout {
  const memo = new Map<string, Arranged>();
  const heights = new Map<string, number>();
  const height = (key: string) => {
    if (!heights.has(key)) heights.set(key, heightOf(forest.classes.get(key)!));
    return heights.get(key)!;
  };

  const arrange = (key: string): Arranged => {
    const done = memo.get(key);
    if (done) return done;
    const h = height(key);
    const children = expanded.has(key) ? (forest.classes.get(key)?.children ?? []) : [];
    let result: Arranged = { width: BOX.width, height: h, anchor: BOX.width / 2, kids: [], lines: [] };
    if (children.length) result = children.length <= ROW_LIMIT ? arrangeRow(h, children) : arrangeStack(h, children);
    memo.set(key, result);
    return result;
  };

  /** The parent box centred over `xs` (the drops of its subclasses), shifted right if it would stick out. */
  const centre = (h: number, xs: number[], kids: Arranged['kids'], lines: Segment[], right: number, bottom: number): Arranged => {
    const mid = (xs[0] + xs[xs.length - 1]) / 2;
    const shift = Math.max(0, BOX.width / 2 - mid);
    const anchor = mid + shift;
    const barY = h + GAP_Y / 2;
    const moved = [vLine(anchor - shift, h + ARROW, barY), hLine(barY, [...xs, anchor - shift]), ...lines].map((s) => ({
      x1: s.x1 + shift,
      y1: s.y1,
      x2: s.x2 + shift,
      y2: s.y2,
    }));
    return {
      width: Math.max(right + shift, anchor + BOX.width / 2),
      height: bottom,
      anchor,
      kids: kids.map((k) => ({ ...k, dx: k.dx + shift })),
      lines: moved,
    };
  };

  const arrangeRow = (h: number, children: string[]): Arranged => {
    const top = h + GAP_Y;
    let x = 0;
    let bottom = 0;
    const kids: Arranged['kids'] = [];
    const xs: number[] = [];
    const lines: Segment[] = [];
    for (const child of children) {
      const sub = arrange(child);
      kids.push({ key: child, dx: x, dy: top });
      xs.push(x + sub.anchor);
      lines.push(vLine(x + sub.anchor, h + GAP_Y / 2, top));
      bottom = Math.max(bottom, top + sub.height);
      x += sub.width + GAP_X;
    }
    return centre(h, xs, kids, lines, x - GAP_X, bottom);
  };

  const arrangeStack = (h: number, children: string[]): Arranged => {
    const top = h + GAP_Y;
    let x = 0;
    let bottom = 0;
    const kids: Arranged['kids'] = [];
    const xs: number[] = [];
    const lines: Segment[] = [];
    for (const column of columnsOf(children)) {
      const spine = x + SPINE;
      let y = top;
      let width = 0;
      let lastTick = top;
      for (const child of column) {
        const sub = arrange(child);
        const tick = y + BOX.padding + BOX.line / 2;
        kids.push({ key: child, dx: x + INDENT, dy: y });
        lines.push(hLine(tick, [spine, x + INDENT + sub.anchor - BOX.width / 2]));
        lastTick = tick;
        width = Math.max(width, sub.width);
        y += sub.height + STACK_GAP;
      }
      lines.push(vLine(spine, h + GAP_Y / 2, lastTick));
      xs.push(spine);
      bottom = Math.max(bottom, y - STACK_GAP);
      x += INDENT + width + GAP_X;
    }
    return centre(h, xs, kids, lines, x - GAP_X, bottom);
  };

  const layout: DiagramLayout = { boxes: [], lines: [], arrows: [], width: 0, height: 0 };
  const place = (key: string, left: number, top: number) => {
    const sub = arrange(key);
    const x = left + sub.anchor - BOX.width / 2;
    layout.boxes.push({ key, x, y: top, height: height(key) });
    if (sub.kids.length) layout.arrows.push({ x: left + sub.anchor, y: top + height(key) });
    for (const s of sub.lines) layout.lines.push({ x1: s.x1 + left, y1: s.y1 + top, x2: s.x2 + left, y2: s.y2 + top });
    for (const kid of sub.kids) place(kid.key, left + kid.dx, top + kid.dy);
    layout.width = Math.max(layout.width, left + sub.width + MARGIN);
    layout.height = Math.max(layout.height, top + sub.height + MARGIN);
  };
  let left = MARGIN;
  for (const root of forest.roots) {
    place(root, left, MARGIN);
    left += arrange(root).width + 2 * GAP_X;
  }
  return layout;
}

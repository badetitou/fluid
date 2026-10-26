import {
  MAX_INTERNAL_DEPTH,
  type Blueprint,
  type BlueprintMethod,
  type MethodKind,
} from './blueprintModel';

// Where every box of the blueprint goes: one column per layer (the internal
// implementation split by call depth, so calls run to the right), boxes
// stacked in each, and the arrows of the calls and accesses between them.

export type ColumnId = 'initialization' | 'external' | 'internal' | 'accessor' | 'attribute';

export interface LayerColumn {
  id: ColumnId;
  title: string;
  x: number;
  width: number;
}

export interface PlacedBox {
  key: string;
  label: string;
  /** A method's kind, or "attribute". */
  kind: MethodKind | 'attribute';
  x: number;
  y: number;
  width: number;
  height: number;
  size?: number;
}

export interface BlueprintEdge {
  from: string;
  to: string;
  kind: 'call' | 'access';
  /** SVG path. */
  d: string;
}

export interface BlueprintLayout {
  /** The layer titles, the internal implementation spanning its depth columns. */
  columns: LayerColumn[];
  boxes: PlacedBox[];
  edges: BlueprintEdge[];
  width: number;
  height: number;
}

export const BOX_WIDTH = 132;
export const HEADER_HEIGHT = 28;
const COLUMN_GAP = 44;
const BOX_GAP = 6;
const PADDING = 8;
const MIN_BOX_HEIGHT = 18;
const MAX_BOX_HEIGHT = 90;
const PX_PER_LINE = 3;
const LOOP = 28;

/** A method's box height: its lines of code, within bounds. */
export const boxHeight = (size: number | undefined) =>
  size === undefined
    ? MIN_BOX_HEIGHT
    : Math.min(MAX_BOX_HEIGHT, Math.max(MIN_BOX_HEIGHT, Math.round(size * PX_PER_LINE)));

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** The methods of each column, left to right: initialization, external, internal by depth, accessors. */
function methodColumns(methods: BlueprintMethod[]): { id: ColumnId; methods: BlueprintMethod[] }[] {
  const of = (layer: BlueprintMethod['layer'], depth?: number) =>
    methods
      .filter(
        (m) =>
          m.layer === layer &&
          (depth === undefined || Math.min(m.depth, MAX_INTERNAL_DEPTH) === depth),
      )
      .sort(byLabel);
  const deepest = Math.min(
    MAX_INTERNAL_DEPTH,
    Math.max(1, ...methods.filter((m) => m.layer === 'internal').map((m) => m.depth)),
  );
  const internal = Array.from({ length: deepest }, (_, i) => ({
    id: 'internal' as const,
    methods: of('internal', i + 1),
  }));
  return [
    { id: 'initialization', methods: of('initialization') },
    { id: 'external', methods: of('external') },
    ...internal,
    { id: 'accessor', methods: of('accessor') },
  ];
}

const TITLES: Record<ColumnId, string> = {
  initialization: 'Initialization',
  external: 'External interface',
  internal: 'Internal implementation',
  accessor: 'Accessors',
  attribute: 'Attributes',
};

/** An arrow from a box's right side to another's left side, or looping on the right when it runs back. */
function edgePath(from: PlacedBox, to: PlacedBox): string {
  const y1 = from.y + from.height / 2;
  const y2 = to.y + to.height / 2;
  const x1 = from.x + from.width;
  if (to.x > from.x) {
    const mid = (x1 + to.x) / 2;
    return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${to.x},${y2}`;
  }
  const x2 = to.x + to.width;
  const out = Math.max(x1, x2) + LOOP;
  return `M${x1},${y1} C${out},${y1} ${out},${y2} ${x2},${y2}`;
}

/** Lays the blueprint out: columns, boxes and arrows, in pixels. */
export function layoutBlueprint(blueprint: Blueprint): BlueprintLayout {
  const stacks = [
    ...methodColumns(blueprint.methods).map((c) => ({
      id: c.id,
      boxes: c.methods.map((m) => ({
        key: m.key,
        label: m.label,
        kind: m.kind,
        size: m.size,
        height: boxHeight(m.size),
      })),
    })),
    {
      id: 'attribute' as const,
      boxes: [...blueprint.attributes].sort(byLabel).map((a) => ({
        key: a.key,
        label: a.label,
        kind: 'attribute' as const,
        height: MIN_BOX_HEIGHT,
      })),
    },
  ];
  const boxes: PlacedBox[] = [];
  const columns: LayerColumn[] = [];
  let height = HEADER_HEIGHT;
  stacks.forEach((stack, i) => {
    const x = PADDING + i * (BOX_WIDTH + COLUMN_GAP);
    let y = HEADER_HEIGHT + PADDING;
    for (const box of stack.boxes) {
      boxes.push({ ...box, x, y, width: BOX_WIDTH });
      y += box.height + BOX_GAP;
    }
    height = Math.max(height, y);
    const last = columns[columns.length - 1];
    if (last?.id === stack.id) last.width = x + BOX_WIDTH - last.x;
    else columns.push({ id: stack.id, title: TITLES[stack.id], x, width: BOX_WIDTH });
  });

  const at = new Map(boxes.map((b) => [b.key, b]));
  const edges: BlueprintEdge[] = blueprint.methods.flatMap((m) => {
    const from = at.get(m.key)!;
    const link = (kind: BlueprintEdge['kind']) => (to: string) => ({
      from: m.key,
      to,
      kind,
      d: edgePath(from, at.get(to)!),
    });
    return [...m.calls.map(link('call')), ...m.accesses.map(link('access'))];
  });
  const width = PADDING * 2 + stacks.length * BOX_WIDTH + (stacks.length - 1) * COLUMN_GAP + LOOP;
  return { columns, boxes, edges, width, height: height + PADDING };
}

import type { PyramidMetricKey, PyramidRatioKey } from '@fluid/shared';
import { METRIC_NAMES, RATIOS, type Triple } from './pyramidDefinitions';
import { classify, formatMetric, formatRatio, ratioValue, type Level, type PyramidValues } from './pyramidModel';

/** The three parts of the pyramid, each with its own tint. */
export type PyramidPart = 'size' | 'coupling' | 'inheritance';

/** One cell of the figure, on a grid of 9 columns and 7 rows. */
export interface PyramidBrick {
  key: string;
  row: number;
  col: number;
  span: number;
  part: PyramidPart;
  kind: 'label' | 'value' | 'ratio' | 'fill';
  /** What the brick shows (empty for a missing value or a filler). */
  text: string;
  /** Full name and explanation, for the tooltip and screen readers. */
  title?: string;
  description?: string;
  /** Ratios: the level of the value and the thresholds it was compared to (no level when it is missing). */
  level?: Level | null;
  thresholds?: Triple;
}

type Cell =
  | { at: [row: number, col: number]; label: PyramidMetricKey; part: PyramidPart }
  | { at: [row: number, col: number]; value: PyramidMetricKey; part: PyramidPart }
  | { at: [row: number, col: number]; ratio: PyramidRatioKey; part: PyramidPart }
  | { at: [row: number, col: number]; fill: number; part: PyramidPart };

// Moose's figure (`OverviewPyramid >> buildBricks`): the size column of values in
// column 5, labels stepping down to the left with each ratio diagonally between
// the two metrics it divides; coupling mirrored on the right; inheritance on top.
const CELLS: Cell[] = [
  { at: [0, 4], label: 'andc', part: 'inheritance' },
  { at: [0, 5], ratio: 'andc', part: 'inheritance' },
  { at: [1, 4], label: 'ahh', part: 'inheritance' },
  { at: [1, 5], ratio: 'ahh', part: 'inheritance' },
  { at: [2, 3], ratio: 'nocNop', part: 'size' },
  { at: [2, 4], label: 'nop', part: 'size' },
  { at: [2, 5], value: 'nop', part: 'size' },
  { at: [3, 2], ratio: 'nomNoc', part: 'size' },
  { at: [3, 3], label: 'noc', part: 'size' },
  { at: [3, 4], fill: 1, part: 'size' },
  { at: [3, 5], value: 'noc', part: 'size' },
  { at: [4, 1], ratio: 'locNom', part: 'size' },
  { at: [4, 2], label: 'nom', part: 'size' },
  { at: [4, 3], fill: 2, part: 'size' },
  { at: [4, 5], value: 'nom', part: 'size' },
  { at: [4, 6], fill: 1, part: 'coupling' },
  { at: [4, 7], ratio: 'callsNom', part: 'coupling' },
  { at: [5, 0], ratio: 'cycloLoc', part: 'size' },
  { at: [5, 1], label: 'loc', part: 'size' },
  { at: [5, 2], fill: 3, part: 'size' },
  { at: [5, 5], value: 'loc', part: 'size' },
  { at: [5, 6], value: 'calls', part: 'coupling' },
  { at: [5, 7], label: 'calls', part: 'coupling' },
  { at: [5, 8], ratio: 'fanoutCalls', part: 'coupling' },
  { at: [6, 0], label: 'cyclo', part: 'size' },
  { at: [6, 1], fill: 4, part: 'size' },
  { at: [6, 5], value: 'cyclo', part: 'size' },
  { at: [6, 6], value: 'fanout', part: 'coupling' },
  { at: [6, 7], fill: 1, part: 'coupling' },
  { at: [6, 8], label: 'fanout', part: 'coupling' },
];

export const PYRAMID_COLUMNS = 9;
export const PYRAMID_ROWS = 7;

function brick(cell: Cell, values: PyramidValues, thresholds: Record<PyramidRatioKey, Triple>): PyramidBrick {
  const [row, col] = cell.at;
  const base = { row, col, span: 1, part: cell.part };
  if ('fill' in cell) return { ...base, key: `fill-${row}-${col}`, span: cell.fill, kind: 'fill', text: '' };
  if ('label' in cell) {
    const { abbr, name } = METRIC_NAMES[cell.label];
    return { ...base, key: `label-${cell.label}`, kind: 'label', text: abbr, title: name };
  }
  if ('value' in cell) {
    const value = values[cell.value];
    const { abbr, name } = METRIC_NAMES[cell.value];
    return { ...base, key: `value-${cell.value}`, kind: 'value', text: value === null ? '' : formatMetric(value), title: `${name} (${abbr})` };
  }
  const value = ratioValue(values, cell.ratio);
  const { name, description } = RATIOS[cell.ratio];
  const triple = thresholds[cell.ratio];
  return {
    ...base,
    key: `ratio-${cell.ratio}`,
    kind: 'ratio',
    text: value === null ? '' : formatRatio(value),
    title: name,
    description,
    level: value === null ? null : classify(value, triple),
    thresholds: triple,
  };
}

/** The bricks of the figure for these values, ratios classified against `thresholds`. */
export function buildBricks(values: PyramidValues, thresholds: Record<PyramidRatioKey, Triple>): PyramidBrick[] {
  return CELLS.map((cell) => brick(cell, values, thresholds));
}

import type { AxisScale, Column, ScatterWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { nodeLabel, type Row } from '../tree/treeModel';

export type { Row };

// Pure logic of the scatter widget: turns the bound rows into dots and lays out
// the plot (scales, ticks, colors) for a given size.

export interface ScatterPoint {
  key: string;
  label: string;
  row: Row;
  /** Data values, before scaling. */
  x: number;
  y: number;
  category?: string;
  size?: number;
}

type PointOptions = Pick<ScatterWidget, 'xField' | 'yField' | 'labelField' | 'colorField' | 'sizeField'>;

/** Categorical palette (G2 "classic"), cycled when there are more categories. */
export const PALETTE = ['#1783FF', '#00C9C9', '#F0884D', '#D580FF', '#7863FF', '#60C42D', '#BD8F24', '#FF80CA', '#2491B3', '#17C76F'];

function toNumber(value: unknown): number | null {
  if (value == null || value === '' || typeof value === 'object') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** One dot per row having numeric x and y values; other rows are left out. */
export function buildPoints(rows: Row[], opts: PointOptions): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  rows.forEach((row, index) => {
    const x = toNumber(getPath(row, opts.xField));
    const y = toNumber(getPath(row, opts.yField));
    if (x === null || y === null) return;
    const category = opts.colorField ? getPath(row, opts.colorField) : undefined;
    points.push({
      key: String(index),
      label: nodeLabel(row, opts.labelField),
      row,
      x,
      y,
      category: opts.colorField ? (category == null || category === '' ? 'Unknown' : String(category)) : undefined,
      size: opts.sizeField ? (toNumber(getPath(row, opts.sizeField)) ?? undefined) : undefined,
    });
  });
  return points;
}

/** The categories of the points, in order of appearance. */
export function categoriesOf(points: ScatterPoint[]): string[] {
  return [...new Set(points.flatMap((p) => (p.category === undefined ? [] : [p.category])))];
}

/** Maps a value to the space the axis is drawn in. `log` keeps 0 (and negatives) on the axis. */
export function transformValue(value: number, scale: AxisScale = 'linear'): number {
  return scale === 'log' ? Math.sign(value) * Math.log10(1 + Math.abs(value)) : value;
}

/** Round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(10)));
  return ticks;
}

/** Ticks of a log axis: 0 and the powers of ten (with 2× and 5× when there are few) within the domain. */
export function logTicks(max: number): number[] {
  const decades = Math.ceil(Math.log10(Math.max(max, 1)));
  const multipliers = decades <= 2 ? [1, 2, 5] : [1];
  const ticks = [0];
  for (let d = 0; d <= decades; d++) for (const m of multipliers) if (m * 10 ** d <= max) ticks.push(m * 10 ** d);
  return ticks;
}

export interface Axis {
  /** Data value → pixel. */
  toPixel: (value: number) => number;
  ticks: number[];
}

/** An axis spanning the values (padded, and including 0 for counts) onto the pixel range [from, to]. */
export function buildAxis(values: number[], scale: AxisScale = 'linear', from: number, to: number): Axis {
  const lo = Math.min(0, ...values);
  const hi = Math.max(lo + 1, ...values);
  const ticks = scale === 'log' && lo >= 0 ? logTicks(hi) : niceTicks(lo, hi);
  const tLo = transformValue(Math.min(lo, ...ticks), scale);
  const tHi = transformValue(Math.max(hi, ...ticks), scale);
  const pad = (tHi - tLo) * 0.04;
  const [dLo, dHi] = [tLo - (lo < 0 ? pad : 0), tHi + pad];
  return { ticks, toPixel: (v) => from + ((transformValue(v, scale) - dLo) / (dHi - dLo)) * (to - from) };
}

/** Deterministic offset in [-1, 1] for a point, so jittered dots do not move between renders. */
export function jitterOffset(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Dot radius: `base`, or between `base` and 3×`base` by the square root of the size value. */
export function radiusScale(points: ScatterPoint[], base: number): (p: ScatterPoint) => number {
  const sizes = points.flatMap((p) => (p.size === undefined ? [] : [Math.abs(p.size)]));
  const max = Math.max(0, ...sizes);
  if (max === 0) return () => base;
  return (p) => base + Math.sqrt(Math.abs(p.size ?? 0) / max) * base * 2;
}

/** The lines shown under the label on hover: the configured fields, else the x and y values. */
export function tooltipColumns(widget: ScatterWidget): Column[] {
  if (widget.tooltipFields) return widget.tooltipFields;
  return [
    { key: widget.xField, title: widget.xTitle },
    { key: widget.yField, title: widget.yTitle },
  ];
}

/** Room left around the plot area for tick labels and axis titles. */
export const MARGIN = { top: 12, right: 16, bottom: 44, left: 56 };

export interface PlacedPoint extends ScatterPoint {
  cx: number;
  cy: number;
  r: number;
  color?: string;
}

export interface ScatterLayout {
  width: number;
  height: number;
  /** Plot area, in px. */
  plot: { left: number; top: number; right: number; bottom: number };
  xAxis: Axis;
  yAxis: Axis;
  points: PlacedPoint[];
  categories: { name: string; color: string }[];
}

type LayoutOptions = Pick<ScatterWidget, 'xScale' | 'yScale' | 'pointSize' | 'jitter'>;

/** Places the dots in a `width` × `height` frame. */
export function buildLayout(points: ScatterPoint[], opts: LayoutOptions, width: number, height: number): ScatterLayout {
  const plot = { left: MARGIN.left, top: MARGIN.top, right: width - MARGIN.right, bottom: height - MARGIN.bottom };
  const xAxis = buildAxis(points.map((p) => p.x), opts.xScale, plot.left, plot.right);
  const yAxis = buildAxis(points.map((p) => p.y), opts.yScale, plot.bottom, plot.top);
  const base = opts.pointSize ?? 5;
  const radius = radiusScale(points, base);
  const categories = categoriesOf(points).map((name, i) => ({ name, color: PALETTE[i % PALETTE.length] }));
  const colors = new Map(categories.map((c) => [c.name, c.color]));
  const spread = opts.jitter ? base * 1.6 : 0;
  return {
    width,
    height,
    plot,
    xAxis,
    yAxis,
    categories,
    points: points.map((p) => ({
      ...p,
      cx: xAxis.toPixel(p.x) + spread * jitterOffset(p.key, 1),
      cy: yAxis.toPixel(p.y) + spread * jitterOffset(p.key, 2),
      r: radius(p),
      color: p.category === undefined ? undefined : colors.get(p.category),
    })),
  };
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** Short tick label: 1200 → "1.2K". */
export const formatTick = (value: number): string => compact.format(value);

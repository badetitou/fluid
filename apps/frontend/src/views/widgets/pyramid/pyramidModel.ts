import {
  PYRAMID_METRICS,
  PYRAMID_RATIOS,
  type PyramidMetric,
  type PyramidMetricKey,
  type PyramidRatioKey,
  type PyramidWidget,
} from '@fluid/shared';
import { getPath } from '../../data';
import { RATIOS, THRESHOLD_PRESETS, type Triple } from './pyramidDefinitions';

export type Level = 'low' | 'average' | 'high';
export type PyramidValues = Record<PyramidMetricKey, number | null>;

/** A metric value: counts and sizes are never negative, so a negative one is unknown (Moose answers -1). */
function toNumber(value: unknown): number | null {
  if (typeof value === 'boolean' || value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A list-valued field counts its items; anything else is read as a number. */
function measure(value: unknown): number | null {
  return Array.isArray(value) ? value.length : toNumber(value);
}

/** The bound data as one object: a list of a single item is that item. */
function subject(data: unknown): unknown {
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

/** Reads one metric from the bound data: a field, or an aggregate over one of its lists. */
export function readMetric(data: unknown, source: PyramidMetric | undefined): number | null {
  if (source == null || data == null) return null;
  if (typeof source === 'string') {
    const value = getPath(subject(data), source);
    return Array.isArray(value) ? (value.length === 1 ? toNumber(value[0]) : null) : toNumber(value);
  }
  const list = source.rows ? getPath(subject(data), source.rows) : data;
  if (list == null) return null;
  const rows = Array.isArray(list) ? list : [list];
  if (source.op === 'count') return rows.length;
  const values = rows.map((row) => measure(getPath(row, source.field))).filter((n): n is number => n !== null);
  // No rows sum to 0; rows whose values are all unknown leave the metric unknown.
  if (values.length === 0) return source.op === 'sum' && rows.length === 0 ? 0 : null;
  const sum = values.reduce((a, b) => a + b, 0);
  return source.op === 'sum' ? sum : sum / values.length;
}

/** Every metric of the pyramid, `null` when it is not configured or not found. */
export function readMetrics(data: unknown, widget: PyramidWidget): PyramidValues {
  return Object.fromEntries(PYRAMID_METRICS.map((key) => [key, readMetric(data, widget[key])])) as PyramidValues;
}

/** The value of a ratio (ANDC and AHH are their own value); `null` when a term is missing or divides by zero. */
export function ratioValue(values: PyramidValues, key: PyramidRatioKey): number | null {
  const { of, per } = RATIOS[key];
  const numerator = values[of];
  if (numerator === null) return null;
  if (!per) return numerator;
  const denominator = values[per];
  return denominator === null || denominator === 0 ? null : numerator / denominator;
}

/** The thresholds of each ratio: the preset (default Java), overridden by `thresholds`. */
export function thresholdsFor(widget: PyramidWidget): Record<PyramidRatioKey, Triple> {
  const preset = THRESHOLD_PRESETS[widget.thresholdPreset ?? 'java'];
  return Object.fromEntries(
    PYRAMID_RATIOS.map((key) => [key, widget.thresholds?.[key] ?? preset[key]]),
  ) as Record<PyramidRatioKey, Triple>;
}

/** The level a value is closest to, as Moose colors it (`colorForMetric:withValue:`). */
export function classify(value: number, [low, average, high]: Triple): Level {
  const distances = [Math.abs(low - value), Math.abs(average - value), Math.abs(high - value)];
  const min = Math.min(...distances);
  if (distances[0] === min) return 'low';
  return distances[1] === min ? 'average' : 'high';
}

/** Truncated to two decimals, as Moose shows ratios. */
export function formatRatio(value: number): string {
  return String(Math.trunc(value * 100) / 100);
}

const integers = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** A raw metric: grouped thousands, two decimals at most for averages. */
export function formatMetric(value: number): string {
  return Number.isInteger(value) ? integers.format(value) : formatRatio(value);
}

/** Why there is no pyramid to draw, or null when at least one metric was found. */
export function emptyReason(data: unknown, values: PyramidValues): string | null {
  if (data == null || (Array.isArray(data) && data.length === 0))
    return 'No data: the query returned nothing to measure.';
  if (PYRAMID_METRICS.every((key) => values[key] === null))
    return 'No metric found: none of the configured fields or lists is in the query result.';
  return null;
}

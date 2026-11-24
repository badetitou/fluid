import type { BoxesWidget } from '@fluid/shared';
import { humanize } from '../../fieldHeuristics';
import type { BoxItem } from './boxesModel';

// What the hover card of a box lists: each mapped metric with its name and role.

export interface BoxMetric {
  /** The field's name, humanized ("Number of methods"). */
  name: string;
  /** What it drives: width, height, size or color. */
  role: string;
  value: string;
}

const GENERIC_COUNT = new Set(['count', 'totalCount']);

/** A short label for a metric path: the alias before a generic count, else the last segment. */
export function metricLabel(field: string): string {
  const parts = field.split('.');
  const last = parts[parts.length - 1] ?? field;
  const name = GENERIC_COUNT.has(last) && parts.length > 1 ? parts[parts.length - 2] : last;
  return humanize(name ?? field);
}

const show = (value: number | string | undefined) =>
  value === undefined ? '—' : typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;

/** The metrics of a box, in the order width, height, size, color (only the configured ones). */
export function boxMetrics(item: BoxItem, widget: Pick<BoxesWidget, 'widthField' | 'heightField' | 'sizeField' | 'colorField'>): BoxMetric[] {
  const entries: [string | undefined, string, number | string | undefined][] = [
    [widget.widthField, 'width', item.width],
    [widget.heightField, 'height', item.height],
    [widget.sizeField, 'size', item.size],
    [widget.colorField, 'color', item.color],
  ];
  return entries.flatMap(([field, role, value]) => (field ? [{ name: metricLabel(field), role, value: show(value) }] : []));
}

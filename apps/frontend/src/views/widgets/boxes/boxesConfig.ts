import type { BoxesWidget } from '@fluid/shared';
import { rowsOf } from '../network/networkModel';

// Reader-facing configuration of a polymetric view: the spec picks the defaults,
// the toolbar lets the reader remap the metrics without editing the view.

export type BoxesOverrideKey = 'widthField' | 'heightField' | 'colorField' | 'boxLayout';

export interface BoxesOverrides {
  widthField?: string | null;
  heightField?: string | null;
  colorField?: string | null;
  boxLayout?: BoxesWidget['boxLayout'] | null;
}

/** `undefined` follows the spec, `null` means none, anything else overrides it. */
const pick = <T>(value: T | null | undefined, fallback: T | undefined): T | undefined =>
  value === undefined ? fallback : value ?? undefined;

/** The widget the renderer uses: the spec with the reader's choices applied. */
export function effectiveBoxesWidget(widget: BoxesWidget, overrides: BoxesOverrides): BoxesWidget {
  const colorField = pick(overrides.colorField, widget.colorField);
  return {
    ...widget,
    widthField: pick(overrides.widthField, widget.widthField),
    heightField: pick(overrides.heightField, widget.heightField),
    colorField,
    colorScale: colorField ? widget.colorScale : undefined,
    boxLayout: pick(overrides.boxLayout, widget.boxLayout) ?? undefined,
  };
}

const MAX_ROWS = 20;
const MAX_DEPTH = 4;
const hidden = (key: string) => key === 'id' || key === 'key' || key.startsWith('__');

function collect(value: unknown, prefix: string, depth: number, out: Set<string>): void {
  if (depth > MAX_DEPTH || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item) => collect(item, prefix, depth, out));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (hidden(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'number' && Number.isFinite(item)) out.add(path);
    else if (typeof item === 'string' && item.trim() !== '' && Number.isFinite(Number(item))) out.add(path);
    else collect(item, path, depth + 1, out);
  }
}

/** Numeric dot paths of the rows, offered by the metric pickers. */
export function metricFields(data: unknown): string[] {
  const found = new Set<string>();
  rowsOf(data).slice(0, MAX_ROWS).forEach((row) => collect(row, '', 0, found));
  return [...found].sort();
}

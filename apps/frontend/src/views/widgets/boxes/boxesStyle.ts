import type { CSSProperties } from 'react';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import type { BoxesModel, BoxItem, ColorScale } from './boxesModel';

// How the boxes look, derived from the theme. Sequential colors are mixes of
// two theme colors (`color-mix`), so any CSS color a theme declares works.

export interface BoxesPalette {
  /** Boxes without color value. */
  box: string;
  /** The two ends of the sequential scale: smallest and largest value. */
  low: string;
  high: string;
  border: string;
  line: string;
  frame: string;
  header: string;
  selection: string;
  series: string[];
}

/**
 * The palette of the boxes from the theme. A theme can override, in
 * `widgets.boxes`: `boxColor`, `lowColor`, `highColor`, `borderColor`,
 * `lineColor`, `frameColor`, `headerColor`, `selectionColor`.
 */
export function boxesPalette(theme: WidgetTheme): BoxesPalette {
  const v = theme.vars;
  return {
    box: v.boxColor ?? theme.surfaceElevated,
    low: v.lowColor ?? `color-mix(in srgb, ${theme.primary} 8%, ${theme.surfaceCard})`,
    high: v.highColor ?? theme.primary,
    border: v.borderColor ?? theme.inkMuted,
    line: v.lineColor ?? theme.inkSecondary,
    frame: v.frameColor ?? theme.border,
    header: v.headerColor ?? theme.surfaceElevated,
    selection: v.selectionColor ?? theme.ink,
    series: theme.series,
  };
}

/** The palette as the CSS variables the module reads. */
export function paletteVariables(palette: BoxesPalette): CSSProperties {
  const vars: Record<string, string> = {
    '--boxes-box': palette.box,
    '--boxes-border': palette.border,
    '--boxes-line': palette.line,
    '--boxes-frame': palette.frame,
    '--boxes-header': palette.header,
    '--boxes-selection': palette.selection,
  };
  return vars as CSSProperties;
}

/** Where `value` sits between min and max, in percent (the middle when they are equal). */
export function ratio(value: number, min: number, max: number): number {
  return max > min ? Math.round(((value - min) / (max - min)) * 100) : 50;
}

/** A sequential color: `high` mixed into `low`, more with a larger value. */
export const sequentialColor = (palette: BoxesPalette, percent: number) =>
  `color-mix(in srgb, ${palette.high} ${percent}%, ${palette.low})`;

/** A category's color in the theme's series. */
export const categoryColor = (palette: BoxesPalette, categories: string[], category: string) =>
  palette.series[Math.max(categories.indexOf(category), 0) % palette.series.length];

/** The fill of a box from its color value and the scale. */
export function fillOf(item: BoxItem, scale: ColorScale, palette: BoxesPalette): string {
  if (scale.kind === 'sequential' && typeof item.color === 'number') {
    return sequentialColor(palette, ratio(item.color, scale.min, scale.max));
  }
  if (scale.kind === 'categorical' && typeof item.color === 'string') return categoryColor(palette, scale.categories, item.color);
  return palette.box;
}

/** The fill of every box. */
export function boxFills(model: BoxesModel, palette: BoxesPalette): Map<string, string> {
  return new Map([...model.items.values()].map((item) => [item.key, fillOf(item, model.color, palette)]));
}

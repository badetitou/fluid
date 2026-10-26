import type { CSSProperties } from 'react';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import { groupColor } from '../network/networkStyle';

// How the matrix looks, derived from the theme. Weights are a sequential scale
// of one color (its opacity over the card), so any theme color works.

export interface MatrixPalette {
  /** Color of a dependency, the heavier the more opaque. */
  cell: string;
  /** Cells of a cycle (A → B and B → A). */
  cycle: string;
  diagonal: string;
  grid: string;
  /** Group separators. */
  separator: string;
  background: string;
  label: string;
  selection: string;
  series: string[];
}

/**
 * The palette of the matrix from the theme. A theme can override, in
 * `widgets.matrix`: `cellColor`, `cycleColor`, `diagonalColor`, `gridColor`,
 * `backgroundColor`, `selectionColor`. `alert` is the theme's error color.
 */
export function matrixPalette(theme: WidgetTheme, alert: string): MatrixPalette {
  const v = theme.vars;
  return {
    cell: v.cellColor ?? theme.primary,
    cycle: v.cycleColor ?? alert,
    diagonal: v.diagonalColor ?? theme.border,
    grid: v.gridColor ?? theme.borderSubtle,
    separator: theme.inkMuted,
    background: v.backgroundColor ?? theme.surfaceCard,
    label: theme.inkSecondary,
    selection: v.selectionColor ?? theme.ink,
    series: theme.series,
  };
}

const MIN_OPACITY = 0.18;

/** Opacity of a cell: from faint (weight close to 0) to opaque (the heaviest), on a square-root scale. */
export function cellOpacity(weight: number, max: number): number {
  if (max <= 0) return 1;
  return MIN_OPACITY + (1 - MIN_OPACITY) * Math.sqrt(Math.min(weight, max) / max);
}

/** The color of a group's band: its rank among the groups, in the theme's series. */
export const bandColor = (groups: string[], group: string, palette: MatrixPalette) =>
  groupColor(groups, group, palette.series);

/** The palette as the CSS variables the module reads. */
export function paletteVariables(palette: MatrixPalette): CSSProperties {
  const vars: Record<string, string> = {
    '--matrix-cell': palette.cell,
    '--matrix-cycle': palette.cycle,
    '--matrix-label': palette.label,
    '--matrix-selection': palette.selection,
    '--matrix-background': palette.background,
  };
  return vars as CSSProperties;
}

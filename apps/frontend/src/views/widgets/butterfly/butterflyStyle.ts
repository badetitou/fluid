import type { CSSProperties } from 'react';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import { groupColor } from '../network/networkStyle';
import { CENTER_ID, type Butterfly } from './butterflyModel';

// How the butterfly map looks, derived from the theme and handed to the CSS
// module as variables: switching theme or mode never lays the map out again.

export interface ButterflyPalette {
  line: string;
  box: string;
  center: string;
  border: string;
  selection: string;
  ink: string;
  series: string[];
}

/**
 * The palette of the butterfly map. A theme can override, in
 * `widgets.butterfly`: `lineColor`, `boxColor`, `centerColor`, `borderColor`,
 * `selectionColor`.
 */
export function butterflyPalette(theme: WidgetTheme): ButterflyPalette {
  const v = theme.vars;
  return {
    line: v.lineColor ?? theme.inkMuted,
    box: v.boxColor ?? theme.surfaceCard,
    center: v.centerColor ?? theme.surfaceElevated,
    border: v.borderColor ?? theme.border,
    selection: v.selectionColor ?? theme.primary,
    ink: theme.ink,
    series: theme.series,
  };
}

/** The palette as the CSS variables the module reads. */
export function paletteVariables(palette: ButterflyPalette): CSSProperties {
  const vars: Record<string, string> = {
    '--bf-line': palette.line,
    '--bf-box': palette.box,
    '--bf-center': palette.center,
    '--bf-border': palette.border,
    '--bf-selection': palette.selection,
    '--bf-ink': palette.ink,
  };
  return vars as CSSProperties;
}

/** The accent of each node (and of the center): its group's color in the series, else the border. */
export function accentColors(butterfly: Butterfly, palette: ButterflyPalette): Map<string, string> {
  const color = (group?: string) => (group === undefined ? palette.border : groupColor(butterfly.groups, group, palette.series));
  const colors = new Map(butterfly.nodes.map((n) => [n.id, color(n.group)]));
  colors.set(CENTER_ID, butterfly.center.group === undefined ? palette.selection : color(butterfly.center.group));
  return colors;
}

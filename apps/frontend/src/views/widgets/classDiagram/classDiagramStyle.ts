import type { CSSProperties } from 'react';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import { groupColor } from '../network/networkStyle';
import type { ClassForest } from './classDiagramModel';

// How the class diagram looks, derived from the theme: handed to the CSS module
// as variables, so switching theme or mode never lays the diagram out again.

export interface ClassDiagramPalette {
  line: string;
  box: string;
  header: string;
  border: string;
  selection: string;
  /** Classes without package. */
  accent: string;
  series: string[];
}

/**
 * The palette of the class diagram from the theme. A theme can override, in
 * `widgets.classDiagram`: `lineColor`, `boxColor`, `headerColor`,
 * `borderColor`, `selectionColor`.
 */
export function classDiagramPalette(theme: WidgetTheme): ClassDiagramPalette {
  const v = theme.vars;
  return {
    line: v.lineColor ?? theme.inkSecondary,
    box: v.boxColor ?? theme.surfaceCard,
    header: v.headerColor ?? theme.surfaceElevated,
    border: v.borderColor ?? theme.border,
    selection: v.selectionColor ?? theme.primary,
    accent: theme.borderSubtle,
    series: theme.series,
  };
}

/** The palette as the CSS variables the module reads. */
export function paletteVariables(palette: ClassDiagramPalette): CSSProperties {
  const vars: Record<string, string> = {
    '--uml-line': palette.line,
    '--uml-box': palette.box,
    '--uml-header': palette.header,
    '--uml-border': palette.border,
    '--uml-selection': palette.selection,
  };
  return vars as CSSProperties;
}

/** The accent of each class: its package's color in the theme's series, else the neutral accent. */
export function accentColors(forest: ClassForest, palette: ClassDiagramPalette): Map<string, string> {
  const colors = new Map<string, string>();
  for (const cls of forest.classes.values()) {
    colors.set(cls.key, cls.group === undefined ? palette.accent : groupColor(forest.groups, cls.group, palette.series));
  }
  return colors;
}

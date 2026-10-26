import type { CSSProperties } from 'react';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import type { PlacedBox } from './blueprintLayout';

// How the blueprint looks, derived from the theme: box colors per kind, handed
// to the CSS module as variables (switching theme never lays it out again).

export type BoxKind = PlacedBox['kind'];

export interface BlueprintPalette {
  kinds: Record<BoxKind, string>;
  edge: string;
  highlight: string;
  box: string;
  border: string;
  ink: string;
}

/** The kinds shown in the legend, in order, with their names. */
export const KIND_LABELS: [BoxKind, string][] = [
  ['constructor', 'Constructor'],
  ['abstract', 'Abstract'],
  ['overriding', 'Overriding'],
  ['accessor', 'Accessor'],
  ['plain', 'Method'],
  ['attribute', 'Attribute'],
];

/**
 * The palette of the blueprint from the theme (series colors by kind). A theme
 * can override, in `widgets.blueprint`: `constructorColor`, `abstractColor`,
 * `overridingColor`, `accessorColor`, `methodColor`, `attributeColor`,
 * `edgeColor`, `highlightColor`.
 */
export function blueprintPalette(theme: WidgetTheme): BlueprintPalette {
  const v = theme.vars;
  const s = (i: number) => theme.series[i % theme.series.length];
  return {
    kinds: {
      constructor: v.constructorColor ?? s(1),
      abstract: v.abstractColor ?? s(2),
      overriding: v.overridingColor ?? s(3),
      accessor: v.accessorColor ?? s(4),
      plain: v.methodColor ?? theme.surfaceElevated,
      attribute: v.attributeColor ?? s(0),
    },
    edge: v.edgeColor ?? theme.inkMuted,
    highlight: v.highlightColor ?? theme.primary,
    box: theme.surfaceCard,
    border: theme.border,
    ink: theme.ink,
  };
}

/** The palette as the CSS variables the module reads. */
export function paletteVariables(palette: BlueprintPalette): CSSProperties {
  const vars: Record<string, string> = {
    '--bp-edge': palette.edge,
    '--bp-highlight': palette.highlight,
    '--bp-box': palette.box,
    '--bp-border': palette.border,
    '--bp-ink': palette.ink,
  };
  for (const [kind, color] of Object.entries(palette.kinds)) vars[`--bp-${kind}`] = color;
  return vars as CSSProperties;
}

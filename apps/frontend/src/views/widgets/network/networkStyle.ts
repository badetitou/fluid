import { getPath } from '../../data';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import type { Network } from './networkModel';

// How the network looks, derived from the theme: node colors and sizes, and the
// appearance of nodes and edges given what is hovered and selected (applied by
// sigma's reducers, so a theme or hover change never rebuilds the graph).

export interface NetworkPalette {
  label: string;
  font: string;
  /** Nodes without group. */
  node: string;
  /** Nodes added for links pointing outside the bound rows, without group. */
  external: string;
  /** Nodes and edges away from the hovered node. */
  nodeMuted: string;
  edge: string;
  edgeMuted: string;
  /** Edges of the hovered or selected node. */
  edgeActive: string;
  selection: string;
  /** The card drawn around the hovered node's label. */
  hoverBackground: string;
  hoverBorder: string;
  series: string[];
}

const DEFAULT_FONT = 'system-ui, sans-serif';

/**
 * The palette of the network from the theme. A theme can override, in
 * `widgets.network`: `edgeColor`, `mutedEdgeColor`, `activeEdgeColor`,
 * `mutedColor`, `externalColor`, `selectionColor`.
 */
export function networkPalette(theme: WidgetTheme): NetworkPalette {
  const v = theme.vars;
  return {
    label: theme.ink,
    font: theme.fontFamily ?? DEFAULT_FONT,
    node: theme.series[0] ?? theme.primary,
    external: v.externalColor ?? theme.inkMuted,
    nodeMuted: v.mutedColor ?? theme.borderSubtle,
    edge: v.edgeColor ?? theme.border,
    edgeMuted: v.mutedEdgeColor ?? theme.borderSubtle,
    edgeActive: v.activeEdgeColor ?? theme.primary,
    selection: v.selectionColor ?? theme.primary,
    hoverBackground: theme.surfaceElevated,
    hoverBorder: theme.border,
    series: theme.series,
  };
}

/** The color of a group: the theme's series, cycled. */
export const groupColor = (groups: string[], group: string, series: string[]): string =>
  series[Math.max(groups.indexOf(group), 0) % series.length];

/** The base color of every node: its group's, else the external or default color. */
export function nodeColors(network: Network, palette: NetworkPalette): Map<string, string> {
  const index = new Map(network.groups.map((g, i) => [g, i]));
  return new Map(
    network.nodes.map((n) => {
      const i = n.group === undefined ? undefined : index.get(n.group);
      const color = i !== undefined ? palette.series[i % palette.series.length] : n.external ? palette.external : palette.node;
      return [n.key, color];
    }),
  );
}

const MIN_SIZE = 3;
const MAX_SIZE = 14;
/** Up to this many nodes, sizes use the whole MIN_SIZE..MAX_SIZE range. */
const CROWDED = 200;

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Node radii in pixels: by `sizeField` when set, else by number of links (square-root scale). */
export function nodeSizes(network: Network, sizeField?: string): Map<string, number> {
  const degree = new Map<string, number>();
  for (const { source, target } of network.edges) {
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  }
  const measure = (key: string, row: Record<string, unknown>) =>
    sizeField ? toNumber(getPath(row, sizeField)) : (degree.get(key) ?? 0);
  const values = network.nodes.map((n) => measure(n.key, n.row));
  const max = values.reduce((a, b) => Math.max(a, b), 0);
  // Sizes are in screen pixels: the more nodes, the smaller the biggest one, or they pile up.
  const range = (MAX_SIZE - MIN_SIZE) * Math.min(1, Math.sqrt(CROWDED / Math.max(1, values.length)));
  return new Map(
    network.nodes.map((n, i) => [n.key, max === 0 ? MIN_SIZE + 1 : MIN_SIZE + range * Math.sqrt(values[i] / max)]),
  );
}

/** What the user points at: the hovered node and its neighbours, the selected node. */
export interface Highlight {
  hovered?: string;
  neighbours: ReadonlySet<string>;
  selected?: string;
  /** Nodes carrying the tag picked in the legend: the others are muted. */
  tagged?: ReadonlySet<string>;
}

export interface NodeLook {
  label: string | null;
  color: string;
  size: number;
  zIndex: number;
  highlighted: boolean;
  forceLabel: boolean;
}

/** A node as drawn: muted away from the hovered node, emphasised when selected. */
export function nodeLook(
  key: string,
  base: { label: string; color: string; size: number },
  highlight: Highlight,
  palette: NetworkPalette,
): NodeLook {
  const look: NodeLook = { ...base, zIndex: 1, highlighted: false, forceLabel: false };
  if (key === highlight.selected) {
    return { ...look, color: palette.selection, size: base.size * 1.4, zIndex: 3, highlighted: true, forceLabel: true };
  }
  if (highlight.tagged && !highlight.tagged.has(key)) return { ...look, label: null, color: palette.nodeMuted, zIndex: 0 };
  if (highlight.hovered === undefined) return look;
  if (key === highlight.hovered) return { ...look, zIndex: 3, forceLabel: true };
  if (highlight.neighbours.has(key)) return { ...look, zIndex: 2, forceLabel: true };
  return { ...look, label: null, color: palette.nodeMuted, zIndex: 0 };
}

export interface EdgeLook {
  color: string;
  size: number;
  zIndex: number;
}

/** An edge as drawn: emphasised when it touches the hovered (or selected) node, muted otherwise while hovering. */
export function edgeLook(
  source: string,
  target: string,
  highlight: Highlight,
  palette: NetworkPalette,
  own?: { color: string; size: number },
): EdgeLook {
  const touches = (key?: string) => key !== undefined && (source === key || target === key);
  if (touches(highlight.hovered) || touches(highlight.selected)) return { color: palette.edgeActive, size: 2, zIndex: 2 };
  if (highlight.hovered !== undefined) return { color: palette.edgeMuted, size: 1, zIndex: 0 };
  return own ? { ...own, zIndex: 1 } : { color: palette.edge, size: 1, zIndex: 1 };
}

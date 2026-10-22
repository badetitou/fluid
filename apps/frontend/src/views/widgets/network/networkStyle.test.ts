import { describe, expect, it } from 'vitest';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import { buildNetwork } from './networkModel';
import { edgeLook, groupColor, networkPalette, nodeColors, nodeLook, nodeSizes } from './networkStyle';

const theme: WidgetTheme = {
  mode: 'light',
  primary: 'primary',
  surface: 'surface',
  surfaceCard: 'card',
  surfaceElevated: 'elevated',
  border: 'border',
  borderSubtle: 'subtle',
  ink: 'ink',
  inkSecondary: 'ink2',
  inkMuted: 'muted',
  link: 'link',
  selected: 'selected',
  series: ['s0', 's1'],
  vars: {},
};
const palette = networkPalette(theme);

const network = buildNetwork(
  [
    { id: 'a', kind: 'class', to: ['b', 'c', 'x'], weight: 4 },
    { id: 'b', kind: 'method', weight: 1 },
    { id: 'c', kind: 'field' },
  ],
  undefined,
  { linksField: 'to', groupField: 'kind' },
);

describe('networkPalette', () => {
  it('takes its colors from the theme tokens', () => {
    expect(palette).toMatchObject({
      label: 'ink',
      node: 's0',
      edge: 'border',
      edgeMuted: 'subtle',
      edgeActive: 'primary',
      nodeMuted: 'subtle',
      external: 'muted',
      selection: 'primary',
      hoverBackground: 'elevated',
    });
    expect(palette.font).toBeTruthy();
  });

  it('lets a theme override the network’s own colors', () => {
    const custom = networkPalette({ ...theme, fontFamily: 'Inter', vars: { edgeColor: 'e', selectionColor: 'sel', mutedColor: 'm' } });
    expect(custom).toMatchObject({ edge: 'e', selection: 'sel', nodeMuted: 'm', font: 'Inter' });
  });
});

describe('node colors and sizes', () => {
  it('colors nodes by group with the series, cycled, and external nodes without group as muted', () => {
    const colors = nodeColors(network, palette);
    expect([colors.get('a'), colors.get('b'), colors.get('c'), colors.get('x')]).toEqual(['s0', 's1', 's0', 'muted']);
    expect(groupColor(network.groups, 'method', palette.series)).toBe('s1');
  });

  it('sizes nodes by number of links, or by `sizeField`', () => {
    const byDegree = nodeSizes(network);
    expect(byDegree.get('a')).toBeGreaterThan(byDegree.get('b') ?? 0);
    expect(byDegree.get('b')).toBe(byDegree.get('c'));
    const byWeight = nodeSizes(network, 'weight');
    expect(byWeight.get('a')).toBe(14);
    expect(byWeight.get('b')).toBe(3 + 11 * 0.5);
    expect(byWeight.get('c')).toBe(3);
  });

  it('shrinks the biggest nodes of crowded graphs', () => {
    const rows = Array.from({ length: 800 }, (_, i) => ({ id: `n${i}`, weight: i }));
    const sizes = nodeSizes(buildNetwork(rows, undefined, { linksField: 'to' }), 'weight');
    expect(sizes.get('n799')).toBeLessThan(14);
    expect(sizes.get('n799')).toBeGreaterThan(sizes.get('n0') ?? 0);
  });
});

describe('highlight', () => {
  const base = { label: 'A', color: 'c', size: 5 };
  const none = { neighbours: new Set<string>() };
  const hovering = { hovered: 'a', neighbours: new Set(['b']) };

  it('draws nodes as they are when nothing is hovered or selected', () => {
    expect(nodeLook('a', base, none, palette)).toMatchObject({ color: 'c', label: 'A', highlighted: false });
    expect(edgeLook('a', 'b', none, palette)).toEqual({ color: 'border', size: 1, zIndex: 1 });
  });

  it('mutes what is away from the hovered node', () => {
    expect(nodeLook('a', base, hovering, palette)).toMatchObject({ color: 'c', forceLabel: true });
    expect(nodeLook('b', base, hovering, palette)).toMatchObject({ color: 'c', forceLabel: true });
    expect(nodeLook('c', base, hovering, palette)).toMatchObject({ color: 'subtle', label: null });
    expect(edgeLook('b', 'a', hovering, palette).color).toBe('primary');
    expect(edgeLook('b', 'c', hovering, palette).color).toBe('subtle');
  });

  it('emphasises the selected node and its edges', () => {
    const selecting = { neighbours: new Set<string>(), selected: 'c' };
    expect(nodeLook('c', base, selecting, palette)).toMatchObject({ color: 'primary', highlighted: true, size: 7 });
    expect(edgeLook('a', 'c', selecting, palette).color).toBe('primary');
  });
});

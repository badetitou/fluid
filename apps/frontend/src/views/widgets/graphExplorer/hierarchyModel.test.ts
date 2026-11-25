import { describe, expect, it } from 'vitest';
import type { GraphExplorerWidget } from '@fluid/shared';
import { buildNetwork } from '../network/networkModel';
import { buildHierarchy, initialHierarchyState, ROOT_KEY } from './hierarchyModel';

const widget: GraphExplorerWidget = {
  id: 'explorer',
  type: 'graphExplorer',
  data: { query: 'q' },
  groupByField: 'package',
  linksField: 'dependencies',
  detailQuery: 'detail',
  widgets: [],
};

const network = buildNetwork(
  [
    { id: 'a', name: 'Alpha', package: 'Core', dependencies: [{ id: 'b' }] },
    { id: 'b', name: 'Beta', package: 'Core', dependencies: [{ id: 'c' }] },
    { id: 'c', name: 'Gamma', package: 'Api', dependencies: [] },
  ],
  undefined,
  widget,
);

describe('hierarchy model', () => {
  it('builds containment boxes and aggregates links to the closest visible ancestor', () => {
    const open = buildHierarchy(network, widget);
    expect(open.nodes.map((n) => n.key)).toContain('h:0:Core');
    expect(open.nodes.filter((n) => n.kind === 'leaf')).toHaveLength(3);
    const folded = buildHierarchy(network, widget, { collapsedGroups: ['h:0:Core'] });
    expect(folded.byKey.has('h:0:Core')).toBe(true);
    expect(folded.byKey.has('a')).toBe(false);
    expect(folded.edges.some((e) => e.source === 'h:0:Core' && e.target === 'c')).toBe(true);
  });

  it('keeps the node id when a leaf opens, so its edges stay attached', () => {
    const closed = buildHierarchy(network, widget);
    const opened = buildHierarchy(network, widget, { expanded: ['a'] });
    expect(closed.byKey.get('a')?.width).toBe(150);
    expect(opened.byKey.get('a')?.width).toBeGreaterThan(150);
    expect(opened.edges.some((e) => e.source === 'a')).toBe(true);
  });

  it('focuses on a neighbourhood while keeping its ancestors visible', () => {
    const focused = buildHierarchy(network, widget, {
      focus: { key: 'a', depth: 1, direction: 'out' },
    });
    expect(focused.byKey.has(ROOT_KEY)).toBe(true);
    expect(focused.byKey.has('h:0:Core')).toBe(true);
    expect(focused.byKey.has('b')).toBe(true);
    expect(focused.byKey.has('c')).toBe(false);
    expect(focused.hidden).toBe(1);
  });

  it('folds large containers in a tree overview but shows every leaf in a network overview', () => {
    const overview = buildHierarchy(network, widget);
    expect(initialHierarchyState(overview, widget).collapsedGroups).toEqual([]);
    const treeWidget = { ...widget, overview: 'tree' as const, collapseAbove: 1 };
    const tree = buildHierarchy(network, treeWidget);
    const initial = initialHierarchyState(tree, treeWidget);
    expect(initial.collapsedGroups).toEqual(['h:0:Core']);
  });
});

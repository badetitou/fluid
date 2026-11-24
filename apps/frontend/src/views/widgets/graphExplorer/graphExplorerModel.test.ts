import { describe, expect, it } from 'vitest';
import type { GraphExplorerWidget } from '@fluid/shared';
import {
  buildExplorerGraph,
  canExpand,
  detailVariables,
  groupKey,
  initialCollapsedGroups,
  limitExpanded,
} from './graphExplorerModel';

const widget = {
  id: 'explorer',
  type: 'graphExplorer',
  data: { query: 'classes' },
  linksField: 'dependencies',
  groupByField: 'package',
  detailQuery: 'classDetail',
  focusDepth: 2,
  focusDirection: 'both',
} as GraphExplorerWidget;

const nodes = [
  { id: 'a', name: 'A', package: 'core', dependencies: [{ id: 'b' }, { id: 'c' }] },
  { id: 'b', name: 'B', package: 'core', dependencies: [] },
  { id: 'c', name: 'C', package: 'api', dependencies: [{ id: 'a' }] },
  { id: 'd', name: 'D', package: 'api', dependencies: [] },
];

describe('graph explorer model', () => {
  it('builds the network from nodes and links', () => {
    const graph = buildExplorerGraph(nodes, undefined, widget);
    expect(graph.all.nodes.map((n) => n.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(graph.all.edges.map((e) => `${e.source}→${e.target}`)).toEqual(['a→b', 'a→c', 'c→a']);
    expect(graph.hidden).toBe(0);
    expect(graph.visible).toEqual(graph.all);
  });

  it('folds a collapsed group into one box and keeps the edges between visible boxes', () => {
    const graph = buildExplorerGraph(nodes, undefined, widget, { collapsedGroups: [groupKey('core')] });
    expect(graph.visible.nodes.map((n) => n.key).sort()).toEqual(['c', 'd', 'group:core']);
    expect(graph.visible.nodes.find((n) => n.key === 'group:core')?.row).toEqual({ name: 'core', count: 2 });
    expect(graph.visible.edges.map((e) => `${e.source}→${e.target}`)).toEqual(['group:core→c', 'c→group:core']);
    expect(graph.hidden).toBe(1); // two nodes became one box
  });

  it('focuses on the neighbourhood of a node', () => {
    const graph = buildExplorerGraph(nodes, undefined, widget, {
      focus: { key: 'b', depth: 1, direction: 'both' },
    });
    expect(graph.visible.nodes.map((n) => n.key)).toEqual(['a', 'b']);
    expect(graph.hidden).toBe(2);
  });

  it('keeps only the newest expansions', () => {
    expect(limitExpanded(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd']);
    expect(limitExpanded(['a', 'a', 'b'], 5)).toEqual(['a', 'b']);
  });

  it('reads the id passed as $nodeId from the expanded node', () => {
    const graph = buildExplorerGraph(nodes, undefined, widget);
    const a = graph.all.nodes[0]!.row;
    expect(detailVariables(widget, a)).toEqual({ nodeId: 'a' });
    expect(detailVariables({ ...widget, detailIdField: 'package' }, a)).toEqual({ nodeId: 'core' });
    expect(canExpand({ ...widget, widgets: [] }, a)).toBe(true);
    expect(canExpand({ ...widget, detailQuery: undefined, widgets: [] }, a)).toBe(false);
  });

  it('folds large groups by default, and every group in a tree overview', () => {
    const graph = buildExplorerGraph(nodes, undefined, widget);
    expect(initialCollapsedGroups(graph.all, widget)).toEqual([]);
    expect(initialCollapsedGroups(graph.all, { ...widget, collapseAbove: 1 })).toEqual([groupKey('core'), groupKey('api')]);
    expect(initialCollapsedGroups(graph.all, { ...widget, overview: 'tree' })).toEqual([
      groupKey('core'),
      groupKey('api'),
    ]);
  });
});

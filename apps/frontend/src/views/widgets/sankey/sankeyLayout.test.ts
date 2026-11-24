import { describe, expect, it } from 'vitest';
import { assignColumns, cycleLinks, nodePriority } from './sankeyColumns';
import { layoutSankey } from './sankeyLayout';
import type { FlowGraph } from './sankeyModel';

function graphOf(edges: [string, string, number?][]): FlowGraph {
  const keys = [...new Set(edges.flatMap(([s, t]) => [s, t]))];
  return {
    nodes: keys.map((key, index) => ({ key, index, rows: [] })),
    links: edges.map(([source, target, value = 1]) => ({ source, target, value, rows: [] })),
    rowCount: edges.length,
    selfLinks: 0,
  };
}

const columnsOf = (graph: FlowGraph, columns?: string[][]) =>
  Object.fromEntries(assignColumns(graph, nodePriority(graph), columns));

describe('sankey columns', () => {
  it('puts each node right after its farthest source, sinks in the last column', () => {
    const graph = graphOf([['A', 'B'], ['B', 'C'], ['A', 'C'], ['A', 'D']]);
    expect(columnsOf(graph)).toEqual({ A: 0, B: 1, C: 2, D: 2 });
  });

  it('cuts cycles where the flow comes back', () => {
    const graph = graphOf([['A', 'B'], ['B', 'C'], ['C', 'B']]);
    const back = [...cycleLinks(graph, nodePriority(graph))];
    expect(back.map((l) => [l.source, l.target])).toEqual([['C', 'B']]);
    expect(columnsOf(graph)).toEqual({ A: 0, B: 1, C: 2 });
  });

  it('keeps pinned nodes in their column and closes the gaps', () => {
    const graph = graphOf([['UI', 'Model'], ['Model', 'Kernel'], ['UI', 'Kernel']]);
    expect(columnsOf(graph, [['UI'], [], ['Kernel'], ['Model']])).toEqual({ UI: 0, Kernel: 1, Model: 2 });
  });

  it('pins whole layers with wildcard patterns', () => {
    const graph = graphOf([
      ['app.entry.Web', 'app.domain.Order'],
      ['app.domain.Order', 'app.persistence.Mapper'],
    ]);
    expect(columnsOf(graph, [['*entry*'], ['*domain*'], ['*persistence*']])).toEqual({
      'app.entry.Web': 0,
      'app.domain.Order': 1,
      'app.persistence.Mapper': 2,
    });
  });

  it('orders nodes by nodeOrder first, then by appearance', () => {
    expect([...nodePriority(graphOf([['A', 'B'], ['C', 'D']]), ['D', 'X', 'C']).keys()]).toEqual(['D', 'C', 'A', 'B']);
  });
});

describe('layoutSankey', () => {
  const graph = graphOf([['A', 'X', 3], ['B', 'X', 1], ['A', 'Y', 1]]);

  it('makes nodes as tall as their flow and ribbons as thick as theirs', () => {
    const layout = layoutSankey(graph, { width: 400, height: 200 });
    const a = layout.nodes.find((n) => n.key === 'A');
    const b = layout.nodes.find((n) => n.key === 'B');
    expect(a && b && (a.y1 - a.y0) / (b.y1 - b.y0)).toBeCloseTo(4);
    const [ax, bx] = layout.links;
    expect(ax.width / bx.width).toBeCloseTo(3);
    expect(Math.max(...layout.nodes.map((n) => n.y1))).toBeLessThanOrEqual(200);
    expect(layout.nodes.find((n) => n.key === 'X')?.labelSide).toBe('left');
    expect(a?.x0).toBe(0);
  });

  it('stacks the ribbons leaving a node without overlap', () => {
    const layout = layoutSankey(graph, { width: 400, height: 200 });
    const a = layout.nodes.find((n) => n.key === 'A');
    const [first, second] = layout.links.filter((l) => l.source === 'A');
    const top = (path: string) => Number(path.split(/[MC,]/)[2]);
    expect(Math.abs(top(first.path) - top(second.path))).toBeCloseTo((first.width + second.width) / 2);
    expect(a && Math.min(top(first.path), top(second.path))).toBeCloseTo((a?.y0 ?? 0) + Math.min(first.width, second.width) / 2);
  });

  it('draws a link closing a cycle as a lane under the figure', () => {
    const layout = layoutSankey(graphOf([['A', 'B'], ['B', 'A']]), { width: 300, height: 120 });
    const back = layout.links.filter((l) => l.back);
    expect(back).toHaveLength(1);
    expect(back[0].my).toBeGreaterThan(Math.max(...layout.nodes.map((n) => n.y1)));
    expect(back[0].my).toBeLessThanOrEqual(120);
  });

  it('uncrosses ribbons by ordering each column by its neighbours', () => {
    const layout = layoutSankey(graphOf([['A', 'Y'], ['B', 'X']]), { width: 300, height: 120, nodeOrder: ['A', 'B'] });
    const y = (key: string) => layout.nodes.find((n) => n.key === key)?.y0 ?? 0;
    expect(y('Y')).toBeLessThan(y('X'));
  });
});

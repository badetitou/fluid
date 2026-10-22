import { describe, expect, it } from 'vitest';
import { adjacencyOf, focusNetwork, neighbourhood } from './focusModel';
import { buildNetwork } from './networkModel';

// a → b → c → d, and e → b
const network = buildNetwork(
  [
    { id: 'a', to: ['b'] },
    { id: 'b', to: ['c'] },
    { id: 'c', to: ['d'] },
    { id: 'd' },
    { id: 'e', to: ['b'] },
  ],
  undefined,
  { linksField: 'to' },
);
const adjacency = adjacencyOf(network.edges);
const sorted = (set: Set<string>) => [...set].sort();

describe('neighbourhood', () => {
  it('follows both directions up to the depth', () => {
    expect(sorted(neighbourhood(adjacency, 'b', 1))).toEqual(['a', 'b', 'c', 'e']);
    expect(sorted(neighbourhood(adjacency, 'b', 2))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('follows outgoing or incoming links only', () => {
    expect(sorted(neighbourhood(adjacency, 'b', 5, 'out'))).toEqual(['b', 'c', 'd']);
    expect(sorted(neighbourhood(adjacency, 'c', 1, 'in'))).toEqual(['b', 'c']);
    expect(sorted(neighbourhood(adjacency, 'c', 2, 'in'))).toEqual(['a', 'b', 'c', 'e']);
  });

  it('terminates on cycles', () => {
    const cycle = adjacencyOf([
      { key: '1', source: 'x', target: 'y' },
      { key: '2', source: 'y', target: 'x' },
    ]);
    expect(sorted(neighbourhood(cycle, 'x', 10))).toEqual(['x', 'y']);
  });
});

describe('focusNetwork', () => {
  it('keeps the neighbourhood and the edges between its nodes', () => {
    const focused = focusNetwork(network, 'c', 1);
    expect(focused.nodes.map((n) => n.key)).toEqual(['b', 'c', 'd']);
    expect(focused.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['b>c', 'c>d']);
  });

  it('keeps the whole network when the start is not in it', () => {
    expect(focusNetwork(network, 'nope', 2)).toBe(network);
  });
});

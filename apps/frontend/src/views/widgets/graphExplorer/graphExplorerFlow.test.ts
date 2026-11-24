import { describe, expect, it } from 'vitest';
import type { Network } from '../network/networkModel';
import { buildFlow } from './graphExplorerFlow';

const network: Network = {
  nodes: [
    { key: 'a', label: 'A', row: { id: 'a' }, external: false },
    { key: 'b', label: 'B', row: { id: 'b' }, external: false },
  ],
  edges: [{ key: 'a→b', source: 'a', target: 'b' }],
  groups: [],
};

describe('graph explorer flow', () => {
  it('turns an expanded node into a box with the SAME id, so its edges stay attached', () => {
    const flow = buildFlow(network, {
      positions: new Map([['a', { x: 12, y: 34 }]]),
      expanded: new Set(['a']),
    });
    expect(flow.nodes[0]).toMatchObject({
      id: 'a',
      type: 'expandedNode',
      position: { x: 12, y: 34 },
      data: { expanded: true, label: 'A' },
    });
    expect(flow.nodes[1].type).toBe('graphNode');
    expect(flow.edges[0]).toMatchObject({ id: 'a→b', source: 'a', target: 'b' });
  });
});

import { describe, expect, it } from 'vitest';
import { EMPTY_DECORATION_INDEX, type DecorationIndex } from '../../plugin-api/decorationModel';
import { decorationOverrides, decorationTags, drawableDerivedEdges, nodesWithTag, toDecoratedGraph } from './networkDecorations';

const status = { error: 'E', warning: 'W', info: 'I' };
const node = (key: string, row: Record<string, unknown>) => ({ key, label: key.toUpperCase(), row, external: false });
const finding = (severity: 'error' | 'warning' | 'info') => ({ decoratorId: 'd', ruleId: 'r', severity, message: 'm' });

describe('toDecoratedGraph', () => {
  it('maps rows, keeping typed fields only', () => {
    const g = toDecoratedGraph(
      [node('a', { kind: 'Class', file: 3, language: 'ts', external: true, tags: ['x'] }), node('b', { tags: [1] })],
      [{ key: 'a→b', source: 'a', target: 'b' }],
    );
    expect(g.nodes[0]).toMatchObject({ key: 'a', name: 'A', kind: 'Class', language: 'ts', external: true, tags: ['x'] });
    expect(g.nodes[0].file).toBeUndefined();
    expect(g.nodes[0].props).toEqual({ kind: 'Class', file: 3, language: 'ts', external: true, tags: ['x'] });
    expect(g.nodes[1].tags).toBeUndefined();
    expect(g.edges).toEqual([{ key: 'a→b', from: 'a', to: 'b', kind: '' }]);
  });
});

describe('toDecoratedGraph self-loops', () => {
  it('hands self-loops to the decorators', () => {
    const g = toDecoratedGraph([node('a', {})], [], ['a']);
    expect(g.edges).toEqual([{ key: 'a→a', from: 'a', to: 'a', kind: '' }]);
  });
});

describe('decorationOverrides', () => {
  it('is empty without decorations', () => {
    const o = decorationOverrides(EMPTY_DECORATION_INDEX, status);
    expect(o.nodeColors.size + o.nodeScale.size + o.edges.size).toBe(0);
  });

  it('colors nodes and edges by worst severity, derived edges by info', () => {
    const index: DecorationIndex = {
      nodes: new Map([
        ['a', { target: { type: 'node', key: 'a' }, tags: ['t'], findings: [finding('warning'), finding('error')] }],
        ['b', { target: { type: 'node', key: 'b' }, tags: ['t'], findings: [] }],
      ]),
      edges: new Map([['e', { target: { type: 'edge', key: 'e' }, tags: [], findings: [finding('warning')] }]]),
      derivedEdges: [{ from: 'a', to: 'b', kind: 'k' }],
    };
    const o = decorationOverrides(index, status);
    expect([...o.nodeColors]).toEqual([['a', 'E']]);
    expect(o.nodeScale.get('a')).toBeGreaterThan(1);
    expect(o.edges.get('e')?.color).toBe('W');
    expect(o.edges.get('a->b:k')?.color).toBe('I');
    expect(decorationTags(index, ['p'])).toEqual([{ tag: 't', color: 'p' }]);
    expect(nodesWithTag(index, 't')).toEqual(new Set(['a', 'b']));
  });
});

describe('drawableDerivedEdges', () => {
  it('keeps edges with both ends, not already drawn, once', () => {
    const d = [{ from: 'a', to: 'b' }, { from: 'a', to: 'z' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a', key: 'x' }];
    expect(drawableDerivedEdges(d, new Set(['a', 'b']), new Set(['x']))).toEqual([{ from: 'a', to: 'b' }]);
  });
});

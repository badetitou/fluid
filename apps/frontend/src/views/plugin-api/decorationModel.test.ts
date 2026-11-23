import { describe, expect, it } from 'vitest';
import type { Decoration } from '@fluid/shared';
import { indexDecorations, severityCounts, tagColor, worstSeverity } from './decorationModel';

const finding = (severity: 'error' | 'warning' | 'info') => ({ decoratorId: 'd', ruleId: 'r', severity, message: 'm' });

describe('decorationModel', () => {
  it('indexes decorations by target type and key', () => {
    const node: Decoration = { target: { type: 'node', key: 'a' }, tags: ['t'], findings: [] };
    const edge: Decoration = { target: { type: 'edge', key: 'a->b:' }, tags: [], findings: [] };
    const index = indexDecorations({ decorations: [node, edge], derivedEdges: [{ from: 'a', to: 'b' }] });
    expect(index.nodes.get('a')).toBe(node);
    expect(index.edges.get('a->b:')).toBe(edge);
    expect(index.derivedEdges).toHaveLength(1);
  });

  it('finds the worst severity, undefined when empty', () => {
    expect(worstSeverity([])).toBeUndefined();
    expect(worstSeverity([finding('info'), finding('error'), finding('warning')])).toBe('error');
    expect(worstSeverity([finding('info'), finding('warning')])).toBe('warning');
  });

  it('handles a single finding', () => {
    expect(worstSeverity([finding('warning')])).toBe('warning');
    expect(severityCounts([finding('warning')])).toEqual({ error: 0, warning: 1, info: 0 });
  });

  it('spreads different tags over the palette', () => {
    const palette = ['#1', '#2', '#3', '#4'];
    const used = new Set(['domain', 'api', 'ui', 'db', 'core', 'infra', 'test', 'util'].map((t) => tagColor(t, palette)));
    expect(used.size).toBeGreaterThan(1);
  });

  it('indexes node and edge decorations apart, even with the same key', () => {
    const node: Decoration = { target: { type: 'node', key: 'k' }, tags: [], findings: [] };
    const edge: Decoration = { target: { type: 'edge', key: 'k' }, tags: [], findings: [] };
    const index = indexDecorations({ decorations: [node, edge], derivedEdges: [] });
    expect(index.nodes.get('k')).toBe(node);
    expect(index.edges.get('k')).toBe(edge);
  });

  it('counts findings per severity', () => {
    expect(severityCounts([finding('info'), finding('error'), finding('info')])).toEqual({ error: 1, warning: 0, info: 2 });
  });

  it('maps a tag onto the palette deterministically', () => {
    const palette = ['#1', '#2', '#3'];
    expect(tagColor('domain', palette)).toBe(tagColor('domain', palette));
    expect(palette).toContain(tagColor('domain', palette));
    expect(tagColor('x', [])).toBeUndefined();
  });
});

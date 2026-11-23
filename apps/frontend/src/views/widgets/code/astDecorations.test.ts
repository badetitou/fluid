import { describe, expect, it } from 'vitest';
import type { CodeRules } from '@fluid/shared';
import { indexDecorations } from '../../plugin-api/decorationModel';
import { astRowsToGraph, findingsToAnnotations } from './astDecorations';

const data = { query: 'ast' };
const finding = { decoratorId: 'd', ruleId: 'java-notify-all', severity: 'warning' as const, message: 'Use notifyAll' };
const indexOf = (...keys: string[]) =>
  indexDecorations({
    derivedEdges: [],
    decorations: keys.map((key) => ({ target: { type: 'node' as const, key }, tags: [], findings: [finding] })),
  });

describe('astRowsToGraph', () => {
  const fields: CodeRules = { data, parentField: 'parent' };
  const rows = [
    { id: 'm', kind: 'Method', name: 'run', parent: null },
    { id: 'c', kind: 'MethodInvocation', name: 'notify', parent: 'm' },
    { id: 'a', kind: 'Argument', parent: { id: 'c' } },
  ];

  it('makes one node per row and a child edge from each parent', () => {
    const graph = astRowsToGraph(rows, fields);
    expect(graph.nodes.map((n) => [n.key, n.kind, n.name])).toEqual([
      ['m', 'Method', 'run'],
      ['c', 'MethodInvocation', 'notify'],
      ['a', 'Argument', undefined],
    ]);
    expect(graph.nodes[1].props).toBe(rows[1]);
    expect(graph.edges).toEqual([
      { from: 'm', to: 'c', kind: 'child' },
      { from: 'c', to: 'a', kind: 'child' },
    ]);
  });

  it('keeps the first row of a duplicate id', () => {
    const graph = astRowsToGraph(
      [{ id: 'a', kind: 'First' }, { id: 'a', kind: 'Second', parent: 'a' }],
      fields,
    );
    expect(graph.nodes.map((n) => n.kind)).toEqual(['First']);
    expect(graph.edges).toEqual([]);
  });

  it('adds no edge to a parent that is not among the rows', () => {
    const graph = astRowsToGraph([{ id: 'a', parent: 'ghost' }], fields);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toEqual([]);
  });

  it('skips rows with a missing or empty id', () => {
    const graph = astRowsToGraph([{ kind: 'X' }, { id: '', kind: 'Y' }, { id: null }, { id: 'ok' }], fields);
    expect(graph.nodes.map((n) => n.key)).toEqual(['ok']);
  });

  it('reads custom fields', () => {
    const graph = astRowsToGraph([{ uid: 3 }, { uid: 7, type: 'If', label: 'x', up: 3 }], {
      data,
      idField: 'uid',
      kindField: 'type',
      nameField: 'label',
      parentField: 'up',
    });
    expect(graph.nodes[1]).toMatchObject({ key: '7', kind: 'If', name: 'x' });
    expect(graph.edges).toEqual([{ from: '3', to: '7', kind: 'child' }]);
  });
});

describe('findingsToAnnotations', () => {
  const source = 'a();\nb.notify();\nc();';

  it('places findings on the line of their node', () => {
    const fields: CodeRules = { data, parentField: 'parent', lineField: 'line', endLineField: 'endLine' };
    const rows = [{ id: 'n', line: 2, endLine: 2 }, { id: 'other', line: 3 }];
    expect(findingsToAnnotations(indexOf('n'), rows, fields, source)).toEqual([
      { line: 2, endLine: 2, message: 'Use notifyAll', severity: 'warning', rule: 'java-notify-all' },
    ]);
  });

  it('places findings from offsets', () => {
    const fields: CodeRules = { data, parentField: 'parent', startOffsetField: 's', endOffsetField: 'e' };
    const [annotation] = findingsToAnnotations(indexOf('n'), [{ id: 'n', s: 7, e: 13 }], fields, source);
    expect(annotation).toMatchObject({ line: 2, endLine: 2, column: 3, endColumn: 9 });
  });

  it('gives one annotation per finding, once per node id', () => {
    const fields: CodeRules = { data, parentField: 'parent', lineField: 'line' };
    const second = { ...finding, ruleId: 'other', severity: 'error' as const, message: 'Second' };
    const index = indexDecorations({
      derivedEdges: [],
      decorations: [{ target: { type: 'node', key: 'n' }, tags: [], findings: [finding, second] }],
    });
    const found = findingsToAnnotations(index, [{ id: 'n', line: 2 }, { id: 'n', line: 3 }], fields, source);
    expect(found.map((a) => [a.line, a.rule, a.severity])).toEqual([
      [2, 'java-notify-all', 'warning'],
      [2, 'other', 'error'],
    ]);
  });

  it('skips rows without a position or without findings', () => {
    const fields: CodeRules = { data, parentField: 'parent', lineField: 'line' };
    const rows = [{ id: 'n' }, { id: 'ok', line: 1 }];
    expect(findingsToAnnotations(indexOf('n', 'x'), rows, fields, source)).toEqual([]);
  });
});

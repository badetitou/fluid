import { describe, expect, it } from 'vitest';
import { buildTree, countNodes, expandedKeys, linkAt, nodeLabel, type TreeNode } from './treeModel';

const labels = (nodes: TreeNode[]): unknown[] =>
  nodes.map((n) => (n.children ? [n.label, labels(n.children)] : n.label));

describe('buildTree', () => {
  it('nests recursive children', () => {
    const data = [{ id: '1', name: 'src', children: [{ id: '2', name: 'main.ts' }, { id: '3', name: 'lib', children: [{ id: '4', name: 'a.ts' }] }] }];
    expect(labels(buildTree(data, { childrenField: 'children' }))).toEqual([['src', ['main.ts', ['lib', ['a.ts']]]]]);
  });

  it('keeps only the roots when the list also holds the descendants', () => {
    const data = [
      { id: '1', name: 'root', children: [{ id: '2', name: 'child' }] },
      { id: '2', name: 'child', children: [] },
    ];
    expect(labels(buildTree(data, { childrenField: 'children' }))).toEqual([['root', ['child']]]);
  });

  it('uses one children field per level for a container chain', () => {
    const data = [{ code: 'EU', name: 'Europe', countries: [{ code: 'FR', name: 'France', states: [{ name: 'Paris' }] }] }];
    const nodes = buildTree(data, { childrenField: ['countries', 'states'], keyField: 'code' });
    expect(labels(nodes)).toEqual([['Europe', [['France', ['Paris']]]]]);
    expect(nodes[0].children![0].key).toBe('/EU/FR');
    expect(nodes[0].children![0].children![0].key).toBe('/EU/FR/#0');
  });

  it('builds the hierarchy from parent pointers', () => {
    const data = [
      { id: 'b', name: 'B', parent: { id: 'a' } },
      { id: 'a', name: 'A', parent: null },
      { id: 'c', name: 'C', parent: { id: 'b' } },
      { id: 'd', name: 'D', parent: { id: 'missing' } },
    ];
    expect(labels(buildTree(data, { parentField: 'parent.id' }))).toEqual([['A', [['B', ['C']]]], 'D']);
  });

  it('survives cyclic parent pointers', () => {
    const data = [
      { id: 'a', parent: { id: 'b' } },
      { id: 'b', parent: { id: 'a' } },
    ];
    expect(buildTree(data, { parentField: 'parent.id' })).toEqual([]);
  });

  it('accepts a single object', () => {
    expect(labels(buildTree({ id: '1', title: 'Only' }, {}))).toEqual(['Only']);
  });
});

describe('nodeLabel', () => {
  it('prefers labelField, then label-ish fields', () => {
    expect(nodeLabel({ name: 'n', path: 'p' }, 'path')).toBe('p');
    expect(nodeLabel({ id: 7, title: 't' })).toBe('t');
    expect(nodeLabel({ other: 1 })).toBe('(unnamed)');
  });
});

describe('expandedKeys / countNodes', () => {
  const nodes = buildTree([{ id: '1', children: [{ id: '2', children: [{ id: '3' }] }] }], { childrenField: 'children' });

  it('expands the nodes above the given depth', () => {
    expect(expandedKeys(nodes, 0)).toEqual([]);
    expect(expandedKeys(nodes, 1)).toEqual(['/1']);
    expect(expandedKeys(nodes, 5)).toEqual(['/1', '/1/2']);
  });

  it('counts every node', () => {
    expect(countNodes(nodes)).toBe(3);
  });
});

describe('linkAt', () => {
  const a = { concept: 'A' };
  const b = { concept: 'B', idField: 'code' };
  it('applies one link to every level, or one link per level', () => {
    expect(linkAt(a, 3)).toBe(a);
    expect(linkAt([a, b, null], 1)).toBe(b);
    expect(linkAt([a, b, null], 2)).toBeUndefined();
    expect(linkAt([a], 5)).toBeUndefined();
    expect(linkAt(undefined, 0)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import type { SankeyWidget } from '@fluid/shared';
import { buildFlows, emptyReason, keysOf, linkSelection, MAX_NODES, nodeSelection } from './sankeyModel';
import { rickAndMortyCharacters } from './sankeyFixture';

const links: SankeyWidget = { id: 's', type: 'sankey', data: { query: 'q' }, sourceField: 'species', targetField: 'status' };
const elements: SankeyWidget = {
  id: 's',
  type: 'sankey',
  data: { query: 'q' },
  groupField: 'parentPackage.name',
  targetsField: 'references.target',
};

const classes = [
  { id: 'a1', parentPackage: { name: 'UI' }, references: [{ target: { parentPackage: { name: 'Model' } } }, { target: { parentPackage: { name: 'Model' } } }] },
  { id: 'a2', parentPackage: { name: 'UI' }, references: [{ target: { parentPackage: { name: 'UI' } } }] },
  { id: 'm1', parentPackage: { name: 'Model' }, references: [{ target: { parentPackage: { name: 'Kernel' } } }] },
  { id: 'k1', parentPackage: { name: 'Kernel' }, references: [] },
];

describe('keysOf', () => {
  it('reads labels, ids, objects holding a name and lists of them', () => {
    expect(keysOf('A')).toEqual(['A']);
    expect(keysOf(3)).toEqual(['3']);
    expect(keysOf({ id: 4, name: 'Pkg' })).toEqual(['Pkg']);
    expect(keysOf([{ id: 'x' }, 'y', null, ''])).toEqual(['x', 'y']);
    expect(keysOf(undefined)).toEqual([]);
  });
});

describe('buildFlows from link rows', () => {
  it('counts each row as one flow, duplicates adding up, with the rows behind each flow', () => {
    const graph = buildFlows(rickAndMortyCharacters, links);
    expect(graph.nodes.map((n) => n.key)).toEqual(['Human', 'Alive', 'Dead', 'Alien', 'unknown']);
    const humanAlive = graph.links.find((l) => l.source === 'Human' && l.target === 'Alive');
    expect(humanAlive?.value).toBe(2);
    expect(humanAlive?.rows.map((r) => r.name)).toEqual(['Rick Sanchez', 'Morty Smith']);
    expect(graph.nodes.find((n) => n.key === 'Alien')?.rows).toHaveLength(4);
  });

  it('weighs flows by valueField and makes one flow per value of a list', () => {
    const rows = [
      { from: 'A', to: ['B', 'C'], n: 3 },
      { from: 'A', to: 'B', n: '2' },
      { from: 'A', to: 'C', n: 'none' },
    ];
    const graph = buildFlows(rows, { ...links, sourceField: 'from', targetField: 'to', valueField: 'n' });
    expect(graph.links.map((l) => [l.source, l.target, l.value])).toEqual([
      ['A', 'B', 5],
      ['A', 'C', 3],
    ]);
  });
});

describe('buildFlows from element rows', () => {
  it('sums element links into group flows, leaving out links inside a group', () => {
    const graph = buildFlows(classes, elements);
    expect(graph.links.map((l) => [l.source, l.target, l.value])).toEqual([
      ['UI', 'Model', 2],
      ['Model', 'Kernel', 1],
    ]);
    expect(graph.selfLinks).toBe(1);
    expect(graph.nodes.find((n) => n.key === 'UI')?.rows.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(graph.nodes.find((n) => n.key === 'Kernel')?.rows.map((r) => r.id)).toEqual(['k1']);
  });

  it('reads the target group with targetGroupField, and scalar targets as groups', () => {
    const rows = [{ pkg: 'A', uses: [{ pkg: { name: 'B' } }] }, { pkg: 'B', uses: ['C'] }];
    const graph = buildFlows(rows, { ...elements, groupField: 'pkg', targetsField: 'uses', targetGroupField: 'pkg.name' });
    expect(graph.links.map((l) => [l.source, l.target])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ]);
  });
});

describe('emptyReason', () => {
  it('says why there is nothing to draw', () => {
    expect(emptyReason(buildFlows([], links), links)).toBe('No data');
    expect(emptyReason(buildFlows([{ species: 'Human' }], links), links)).toContain('"species" and "status"');
    expect(emptyReason(buildFlows([classes[1]], elements), elements)).toContain('inside its own group');
    expect(emptyReason(buildFlows([classes[3]], elements), elements)).toContain('"references.target" is empty');
    expect(emptyReason(buildFlows(rickAndMortyCharacters, links), links)).toBeUndefined();
  });

  it('asks to filter beyond the node limit', () => {
    const rows = Array.from({ length: MAX_NODES }, (_, i) => ({ species: `s${i}`, status: `t${i}` }));
    expect(emptyReason(buildFlows(rows, links), links)).toContain('Too many nodes');
  });
});

describe('selection values', () => {
  it('emits a node as its group and rows, a ribbon as its ends, value and rows', () => {
    const graph = buildFlows(rickAndMortyCharacters, links);
    expect(nodeSelection(graph.nodes[2])).toEqual({ group: 'Dead', rows: [rickAndMortyCharacters[2]] });
    const flow = graph.links.find((l) => l.target === 'Dead');
    expect(flow && linkSelection(flow)).toEqual({ source: 'Human', target: 'Dead', value: 1, rows: [rickAndMortyCharacters[2]] });
  });
});

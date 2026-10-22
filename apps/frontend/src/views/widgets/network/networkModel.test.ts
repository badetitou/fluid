import { describe, expect, it } from 'vitest';
import { buildNetwork, emptyReason, idOf, linkFor, missingLinksReason, rowsOf } from './networkModel';

const keys = (items: { key: string }[]) => items.map((i) => i.key);
const pairs = (edges: { source: string; target: string }[]) => edges.map((e) => `${e.source}>${e.target}`);

describe('rowsOf / idOf', () => {
  it('keeps the object rows of a list, or a single object', () => {
    expect(rowsOf([{ id: 1 }, null, 3, 'x', [1], { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
    expect(rowsOf({ id: 1 })).toEqual([{ id: 1 }]);
    expect(rowsOf(undefined)).toEqual([]);
    expect(rowsOf('nope')).toEqual([]);
  });

  it('reads ids as scalars or in the objects holding them', () => {
    expect(idOf(3, 'id')).toBe('3');
    expect(idOf('A', 'id')).toBe('A');
    expect(idOf({ key: { id: 'k' } }, 'key.id')).toBe('k');
    expect(idOf({ id: 'x' }, 'id')).toBe('x');
    expect(idOf('', 'id')).toBeUndefined();
    expect(idOf(Number.NaN, 'id')).toBeUndefined();
    expect(idOf({ id: { nested: 1 } }, 'id')).toBeUndefined();
    expect(idOf([1, 2], 'id')).toBeUndefined();
  });
});

describe('buildNetwork', () => {
  const classes = [
    { id: 'A', name: 'Alpha', kind: 'class', uses: [{ id: 'B' }, { id: 'C', name: 'Gamma', kind: 'class' }] },
    { id: 'B', name: 'Beta', kind: 'class', uses: ['A', 'B', 'A', 'Z'] },
  ];

  it('deduces edges from a list of ids or objects, without loops nor duplicates', () => {
    const network = buildNetwork(classes, undefined, { linksField: 'uses', labelField: 'name', groupField: 'kind' });
    expect(pairs(network.edges)).toEqual(['A>B', 'A>C', 'B>A', 'B>Z']);
    expect(keys(network.nodes)).toEqual(['A', 'B', 'C', 'Z']);
    expect(network.groups).toEqual(['class']);
  });

  it('adds the missing ends as nodes, built from the linked object when there is one', () => {
    const { nodes } = buildNetwork(classes, undefined, { linksField: 'uses', labelField: 'name', groupField: 'kind' });
    const c = nodes.find((n) => n.key === 'C');
    const z = nodes.find((n) => n.key === 'Z');
    expect(c).toMatchObject({ label: 'Gamma', group: 'class', external: true });
    expect(z).toMatchObject({ label: 'Z', group: undefined, external: true, row: {} });
    expect(nodes.find((n) => n.key === 'A')?.external).toBe(false);
  });

  it('completes a node first met as a bare id with the first object describing it', () => {
    const rows = [
      { id: 'A', links: ['X'] },
      { id: 'B', links: [{ id: 'X', name: 'Ex' }] },
    ];
    const x = buildNetwork(rows, undefined, { linksField: 'links' }).nodes.find((n) => n.key === 'X');
    expect(x).toMatchObject({ label: 'Ex', external: true });
  });

  it('drops the links to missing nodes when asked to', () => {
    const network = buildNetwork(classes, undefined, { linksField: 'uses', missingNodes: 'ignore' });
    expect(keys(network.nodes)).toEqual(['A', 'B']);
    expect(pairs(network.edges)).toEqual(['A>B', 'B>A']);
  });

  it('reads edges from edge rows, with ids or objects at both ends', () => {
    const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const edges = [
      { caller: { id: 1 }, callee: { id: 2 } },
      { caller: { id: 1 }, callee: { id: 2 } },
      { caller: 2, callee: 3 },
      { caller: 3, callee: 3 },
      { caller: 3 },
    ];
    const network = buildNetwork(nodes, edges, { sourceField: 'caller', targetField: 'callee' });
    expect(pairs(network.edges)).toEqual(['1>2', '2>3']);
    expect(pairs(buildNetwork(nodes, [{ source: 1, target: 3 }], {}).edges)).toEqual(['1>3']);
  });

  it('combines both forms of edges', () => {
    const network = buildNetwork([{ id: 'a', to: ['b'] }, { id: 'b' }], [{ source: 'b', target: 'a' }], { linksField: 'to' });
    expect(pairs(network.edges)).toEqual(['a>b', 'b>a']);
  });

  it('reads the id from `idField`, keeps the first of duplicated ids and skips rows without id', () => {
    const rows = [{ code: 'FR', name: 'France' }, { code: 'FR', name: 'Again' }, { name: 'No code' }];
    const network = buildNetwork(rows, undefined, { idField: 'code', linksField: 'x' });
    expect(network.nodes.map((n) => n.label)).toEqual(['France']);
  });

  it('turns invalid data into an empty network', () => {
    expect(buildNetwork('garbage', 42, { linksField: 'x' })).toEqual({ nodes: [], edges: [], groups: [] });
    expect(buildNetwork(null, [{ source: null, target: {} }], {})).toEqual({ nodes: [], edges: [], groups: [] });
  });
});

describe('explanations', () => {
  it('says why nothing is drawn', () => {
    const empty = buildNetwork([], undefined, {});
    expect(emptyReason([], empty)).toMatch(/no rows/);
    expect(emptyReason([{ name: 'x' }], buildNetwork([{ name: 'x' }], undefined, {}), 'key')).toMatch(/"key"/);
    expect(emptyReason([{ id: 1 }], buildNetwork([{ id: 1 }], undefined, {}))).toBeNull();
  });

  it('says why no link is drawn', () => {
    const lonely = buildNetwork([{ id: 1 }], undefined, {});
    expect(missingLinksReason(lonely, { linksField: 'calls' })).toMatch(/"calls"/);
    expect(missingLinksReason(lonely, {})).toMatch(/"source".*"target"/);
    const linked = buildNetwork([{ id: 1, to: [2] }], undefined, { linksField: 'to' });
    expect(missingLinksReason(linked, { linksField: 'to' })).toBeNull();
  });
});

describe('linkFor', () => {
  const linkTo = { concept: 'Thing' };
  const linkToByGroup = { Method: { concept: 'Method', idField: 'id' } };

  it('prefers the link of the node’s group, else the common one', () => {
    expect(linkFor({ group: 'Method' }, { linkTo, linkToByGroup })).toEqual(linkToByGroup.Method);
    expect(linkFor({ group: 'Class' }, { linkTo, linkToByGroup })).toEqual(linkTo);
    expect(linkFor({ group: undefined }, { linkTo, linkToByGroup })).toEqual(linkTo);
    expect(linkFor({ group: 'Class' }, { linkToByGroup })).toBeUndefined();
  });
});

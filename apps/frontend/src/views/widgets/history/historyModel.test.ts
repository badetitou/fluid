import { describe, expect, it } from 'vitest';
import {
  buildNodes,
  idOf,
  initials,
  listOf,
  missingLinksHint,
  orderChildrenFirst,
  relativeTime,
  shortId,
  type HistoryNode,
} from './historyModel';

const node = (key: string, parents: string[] = [], time?: number): HistoryNode => ({ key, parents, label: key, row: {}, time, refs: [] });
const keys = (nodes: HistoryNode[]) => nodes.map((n) => n.key);

describe('idOf / listOf', () => {
  it('reads ids from scalars, a given field, or the usual id fields', () => {
    expect(idOf('abc')).toBe('abc');
    expect(idOf({ oid: 'x' })).toBe('x');
    expect(idOf({ ref: { sha: 'y' } }, 'ref.sha')).toBe('y');
    expect(idOf({ name: 'n' })).toBeUndefined();
  });

  it('reads plain lists and GraphQL connections', () => {
    expect(listOf(['a'])).toEqual(['a']);
    expect(listOf({ nodes: [{ oid: 'a' }] })).toEqual([{ oid: 'a' }]);
    expect(listOf({ edges: [{ node: { oid: 'a' } }] })).toEqual([{ oid: 'a' }]);
    expect(listOf(null)).toEqual([]);
    expect(listOf('a')).toEqual(['a']);
  });
});

describe('buildNodes', () => {
  const rows = [
    {
      oid: 'c2',
      messageHeadline: 'Merge feature',
      committedDate: '2026-10-21T10:00:00Z',
      author: { name: 'Ada Lovelace', avatarUrl: 'https://example.org/ada.png' },
      parents: { nodes: [{ oid: 'c1' }, { oid: 'f1' }] },
      refs: [{ name: 'main' }, 'v1.0'],
    },
    { oid: 'c1', parents: { nodes: [] } },
    { oid: 'c1', parents: { nodes: [] } },
  ];

  it('extracts ids, parents, label, author, date and refs', () => {
    const [merge, root] = buildNodes(rows, {
      parentsField: 'parents',
      authorField: 'author.name',
      avatarField: 'author.avatarUrl',
      dateField: 'committedDate',
      refsField: 'refs',
    });
    expect(merge).toMatchObject({
      key: 'c2',
      parents: ['c1', 'f1'],
      label: 'Merge feature',
      author: 'Ada Lovelace',
      avatar: 'https://example.org/ada.png',
      time: Date.parse('2026-10-21T10:00:00Z'),
      refs: ['main', 'v1.0'],
    });
    expect(root.parents).toEqual([]);
  });

  it('drops duplicate ids and keys rows without an id by index', () => {
    expect(keys(buildNodes(rows, { parentsField: 'parents' }))).toEqual(['c2', 'c1']);
    expect(keys(buildNodes([{ title: 'draft' }], { parentsField: 'parents' }))).toEqual(['#0']);
  });

  it('accepts plain id lists, and ignores a version listed as its own parent', () => {
    const [n] = buildNodes([{ id: 'r2', parentIds: ['r1', 'r2', 'r1'] }], { parentsField: 'parentIds' });
    expect(n.parents).toEqual(['r1']);
  });
});

describe('buildNodes with children and nested versions', () => {
  it('turns children links into parents', () => {
    const rows = [
      { id: 'a', children: [{ id: 'b' }, { id: 'c' }] },
      { id: 'b', children: ['d'] },
      { id: 'c', children: [{ id: 'd' }] },
      { id: 'd', children: [] },
    ];
    const nodes = buildNodes(rows, { childrenField: 'children' });
    expect(Object.fromEntries(nodes.map((n) => [n.key, n.parents]))).toEqual({ a: [], b: ['a'], c: ['a'], d: ['b', 'c'] });
  });

  it('merges parents and children links, explicit parents first', () => {
    const rows = [
      { id: 'b', previous: [{ id: 'a' }], next: [] },
      { id: 'x', next: [{ id: 'b' }] },
      { id: 'a' },
    ];
    const [b] = buildNodes(rows, { parentsField: 'previous', childrenField: 'next' });
    expect(b.parents).toEqual(['a', 'x']);
  });

  it('reads the versions nested in a recursive selection', () => {
    const root = {
      id: 'r1',
      comment: 'created',
      children: [{ id: 'r2', comment: 'typo', children: [{ id: 'r3', comment: 'rewrite', children: [] }] }, { id: 'r4', comment: 'draft' }],
    };
    const nodes = buildNodes([root], { childrenField: 'children' });
    expect(nodes.map((n) => [n.key, n.label, n.parents])).toEqual([
      ['r1', 'created', []],
      ['r2', 'typo', ['r1']],
      ['r4', 'draft', ['r1']],
      ['r3', 'rewrite', ['r2']],
    ]);
  });

  it('does not turn id-only references into versions', () => {
    const nodes = buildNodes([{ oid: 'b', message: 'm', parents: [{ oid: 'a', __typename: 'Commit' }] }], { parentsField: 'parents' });
    expect(keys(nodes)).toEqual(['b']);
  });

  it('follows deep paths, crossing lists and connections', () => {
    const rows = [{ sha: 'b', meta: { parents: { nodes: [{ commit: { sha: 'a' } }] } } }];
    expect(buildNodes(rows, { parentsField: 'meta.parents.nodes.commit.sha' })[0].parents).toEqual(['a']);
    const crossing = [{ sha: 'm', merges: [{ from: [{ sha: 'x' }] }, { from: [{ sha: 'y' }] }] }];
    expect(buildNodes(crossing, { parentsField: 'merges.from' })[0].parents).toEqual(['x', 'y']);
    expect(buildNodes([{ id: 'x', parents: [{ nodes: [{ id: 'p' }] }] }], { parentsField: 'parents' })[0].parents).toEqual(['p']);
  });
});

describe('orderChildrenFirst', () => {
  it('keeps an already ordered history', () => {
    const nodes = [node('c', ['b']), node('b', ['a']), node('a')];
    expect(keys(orderChildrenFirst(nodes))).toEqual(['c', 'b', 'a']);
  });

  it('reverses a history listed oldest first', () => {
    const nodes = [node('a'), node('b', ['a']), node('c', ['b'])];
    expect(keys(orderChildrenFirst(nodes))).toEqual(['c', 'b', 'a']);
  });

  it('interleaves unrelated branches newest first by date', () => {
    const nodes = [node('a', [], 1), node('x', ['a'], 2), node('y', ['a'], 4), node('x2', ['x'], 3)];
    expect(keys(orderChildrenFirst(nodes))).toEqual(['y', 'x2', 'x', 'a']);
  });

  it('breaks cycles instead of looping', () => {
    const nodes = [node('a', ['b']), node('b', ['a'])];
    expect(keys(orderChildrenFirst(nodes)).sort()).toEqual(['a', 'b']);
  });
});

describe('missingLinksHint', () => {
  it('explains a history of several versions without any link', () => {
    const unlinked = [node('a'), node('b')];
    expect(missingLinksHint(unlinked, {})).toMatch(/set "parentsField" or "childrenField"/);
    expect(missingLinksHint(unlinked, { parentsField: 'parentCommits' })).toMatch(/in "parentCommits": check that the query selects them/);
  });

  it('says nothing when a version is linked, even outside the rows, or alone', () => {
    expect(missingLinksHint([node('a', ['gone']), node('b')], { parentsField: 'parents' })).toBeUndefined();
    expect(missingLinksHint([node('a')], {})).toBeUndefined();
  });
});

describe('shortId / initials', () => {
  it('shortens hashes only', () => {
    expect(shortId('a1335f3b45bf05796db7')).toBe('a1335f3');
    expect(shortId('rev-12')).toBe('rev-12');
  });

  it('takes the initials of an author', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('badetitou')).toBe('BA');
    expect(initials(undefined)).toBe('?');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  it('says how long ago, in the largest fitting unit', () => {
    expect(relativeTime(now - 30e3, now)).toBe('now');
    expect(relativeTime(now - 3 * 3600e3, now)).toBe('3h ago');
    expect(relativeTime(now - 2 * 86400e3, now)).toBe('2d ago');
    expect(relativeTime(now - 400 * 86400e3, now)).toBe('last yr.');
  });
});

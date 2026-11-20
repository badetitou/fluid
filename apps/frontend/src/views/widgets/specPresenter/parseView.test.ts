import { describe, expect, it } from 'vitest';
import type { ViewNode } from '@fluid/shared';
import { pageableNodes, parseOpenView } from './parseView';
import { fameTab } from './specPresenterFixture';

const list: ViewNode = { kind: 'list', items: [{ cells: [{ text: 'a' }] }], total: 3 };

describe('parseOpenView', () => {
  it('reads an Open Views response with its actions', () => {
    const doc = parseOpenView({ key: 'k', title: 'K', priority: 1, view: list, actions: [{ id: 'go', label: 'Go' }] }).doc;
    expect(doc).toEqual({ node: list, actions: [{ id: 'go', label: 'Go' }] });
  });

  it('reads a bare view node, without actions', () => {
    expect(parseOpenView(list).doc).toEqual({ node: list, actions: [] });
  });

  it('reads a whole view, composites and tabs included', () => {
    expect(parseOpenView(fameTab).doc?.node).toEqual(fameTab);
  });

  it('explains a missing or invalid document, with where it breaks', () => {
    expect(parseOpenView(undefined).reason).toMatch(/returned nothing/);
    expect(parseOpenView(null).reason).toMatch(/returned nothing/);
    expect(parseOpenView({ kind: 'composite', direction: 'row', children: [{ kind: 'list' }] }).reason).toMatch(
      /^Not an Open Views document \(at children\.0\.items\)/,
    );
    expect(parseOpenView({ view: list, actions: [{ label: 'x' }] }).reason).toMatch(/^Not a list of view actions \(at 0\.id\)/);
  });
});

describe('unknown kinds', () => {
  it('become unsupported wherever a node can be, the rest of the view kept', () => {
    const raw = { kind: 'tabs', tabs: [{ title: 'A', node: { kind: 'composite', direction: 'row', children: [{ kind: 'chart' }] } }] };
    expect(parseOpenView(raw).doc?.node).toEqual({
      kind: 'tabs',
      tabs: [{ title: 'A', node: { kind: 'composite', direction: 'row', children: [{ kind: 'unsupported', type: 'chart' }] } }],
    });
  });

  it('include the old Spec-Fluid kinds, which are no longer read', () => {
    expect(parseOpenView({ kind: 'table', columns: [], rows: [] }).doc?.node).toMatchObject({ kind: 'unsupported', type: 'table' });
  });
});

describe('pageableNodes', () => {
  it('numbers lists and trees depth first, through composites and tabs, in document order', () => {
    const tree: ViewNode = { kind: 'tree', roots: [] };
    const table: ViewNode = { kind: 'columnedList', columns: [], items: [] };
    const root: ViewNode = {
      kind: 'composite',
      direction: 'column',
      children: [{ kind: 'tabs', tabs: [{ title: 'a', node: tree }, { title: 'b', node: { kind: 'label', text: 'x' } }] }, list, table],
    };
    const indices = pageableNodes(root);
    expect([indices.get(tree), indices.get(list), indices.get(table)]).toEqual([0, 1, 2]);
    expect(indices.size).toBe(3);
  });
});

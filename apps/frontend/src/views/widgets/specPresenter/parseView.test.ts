import { describe, expect, it } from 'vitest';
import type { ViewNode } from '@fluid/shared';
import { looksLegacy, pageableNodes, parseOpenView, unknownKindsAsUnsupported } from './parseView';
import { fameTab, hierarchySvg, methodsTable, sourceNotebook } from './specPresenterFixture';

const list: ViewNode = { kind: 'list', items: [{ cells: [{ text: 'a' }] }], total: 3 };

describe('parseOpenView', () => {
  it('reads an Open Views response with its actions', () => {
    const doc = parseOpenView({ key: 'k', title: 'K', priority: 1, view: list, actions: [{ id: 'go', label: 'Go' }] }).doc;
    expect(doc).toEqual({ node: list, actions: [{ id: 'go', label: 'Go' }] });
  });

  it('reads a bare view node, without actions', () => {
    expect(parseOpenView(list).doc).toEqual({ node: list, actions: [] });
  });

  it('converts an old Spec-Fluid node, or tab with its root', () => {
    expect(parseOpenView(methodsTable).doc?.node.kind).toBe('columnedList');
    expect(parseOpenView(sourceNotebook).doc?.node.kind).toBe('tabs');
    expect(parseOpenView({ key: 't', title: 'T', order: 1, root: fameTab }).doc?.node.kind).toBe('composite');
    const svg = parseOpenView(hierarchySvg).doc?.node;
    expect(svg?.kind === 'svg' && svg.hotspots).toEqual([{ ref: { id: 'c2', type: 'Class' }, x: 100, y: 0, width: 80, height: 30 }]);
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
  it('become unsupported wherever a node can be', () => {
    const raw = { kind: 'tabs', tabs: [{ title: 'A', node: { kind: 'composite', direction: 'row', children: [{ kind: 'chart' }] } }] };
    expect(unknownKindsAsUnsupported(raw)).toEqual({
      kind: 'tabs',
      tabs: [{ title: 'A', node: { kind: 'composite', direction: 'row', children: [{ kind: 'unsupported', type: 'chart' }] } }],
    });
  });

  it('leave known nodes and non-nodes alone', () => {
    expect(unknownKindsAsUnsupported(list)).toBe(list);
    expect(unknownKindsAsUnsupported('x')).toBe('x');
  });
});

describe('looksLegacy', () => {
  it('spots the fields only Spec-Fluid has', () => {
    expect(looksLegacy(methodsTable)).toBe(true);
    expect(looksLegacy(hierarchySvg)).toBe(true);
    expect(looksLegacy({ kind: 'unsupported', presenter: 'X' })).toBe(true);
    expect(looksLegacy({ kind: 'tree', roots: [{ cells: [], children: [{ cells: [], hasMore: true }] }] })).toBe(true);
  });

  it('does not take an Open Views document for an old one', () => {
    expect(looksLegacy(list)).toBe(false);
    expect(looksLegacy({ kind: 'svg', svg: '<svg/>', hotspots: [] })).toBe(false);
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

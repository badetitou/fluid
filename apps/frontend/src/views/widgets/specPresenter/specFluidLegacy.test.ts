import {
  specFluidNodeToViewNode,
  specFluidTabToView,
  specFluidTabsToViews,
  viewNodeSchema,
  viewResponseSchema,
  type ViewNode,
} from '@fluid/shared';
import { describe, expect, it } from 'vitest';
import {
  commitHeader,
  fameTab,
  hierarchySvg,
  methodDiff,
  methodsTable,
  packagesTree,
  sourceNotebook,
} from './specPresenterFixture';

// The old Spec-Fluid fixtures, read as fluid Open Views (#49).

describe('Spec-Fluid to Open Views', () => {
  it.each([
    ['table', methodsTable],
    ['tree', packagesTree],
    ['svg', hierarchySvg],
    ['composite', fameTab],
    ['notebook', sourceNotebook],
    ['diff', methodDiff],
    ['labels', commitHeader],
  ])('converts the %s fixture into a valid view node', (_name, node) => {
    expect(viewNodeSchema.safeParse(specFluidNodeToViewNode(node)).success).toBe(true);
  });

  it('turns a table into a columned list', () => {
    const view = specFluidNodeToViewNode(methodsTable);
    expect(view).toMatchObject({ kind: 'columnedList', columns: [{ title: 'Method' }, { title: 'Lines' }, { title: '' }] });
    if (view.kind !== 'columnedList') throw new Error(view.kind);
    expect(view.truncated).toBe(true);
    expect(view.items[0]?.cells[0]).toEqual({ text: 'printOn:', ref: { id: 'm1', type: 'Method' } });
    expect(view.items[2]?.ref).toEqual({ id: 'm3', type: 'Method' });
  });

  it('marks tree nodes with more children as truncated', () => {
    const view = specFluidNodeToViewNode(packagesTree);
    if (view.kind !== 'tree') throw new Error(view.kind);
    expect(view.roots[0]?.children?.[0]).toEqual({
      cells: [{ text: 'Collections-Abstract', ref: { id: 'p2', type: 'Package' } }],
      truncated: true,
    });
  });

  it('turns svg refs into hotspots', () => {
    const view = specFluidNodeToViewNode(hierarchySvg);
    expect(view).toMatchObject({ kind: 'svg', hotspots: [{ ref: { id: 'c2', type: 'Class' }, x: 100 }] });
  });

  it('turns a notebook into tabs and keeps the selected page', () => {
    expect(specFluidNodeToViewNode(sourceNotebook)).toEqual({
      kind: 'tabs',
      selected: 1,
      tabs: [
        { title: 'Methods', node: specFluidNodeToViewNode(methodsTable) },
        { title: 'Source', node: { kind: 'text', text: 'size\n\t^ tally' } },
      ],
    });
  });

  it('converts composites deeply and renames unsupported presenters', () => {
    const view = specFluidNodeToViewNode(fameTab);
    if (view.kind !== 'composite') throw new Error(view.kind);
    const kinds = (node: ViewNode): string[] =>
      node.kind === 'composite' ? node.children.flatMap(kinds) : [node.kind];
    expect(kinds(view)).toEqual(['columnedList', 'tree', 'svg', 'text', 'unsupported']);
    expect(view.children[3]).toEqual({
      kind: 'unsupported',
      type: 'SpRoassalInspectorPresenter',
      message: 'animated canvas',
    });
  });

  it('keeps text, labels and diffs as they are', () => {
    expect(specFluidNodeToViewNode(methodDiff)).toEqual(methodDiff);
    expect(specFluidNodeToViewNode(commitHeader)).toEqual(commitHeader);
  });

  it('converts the tabs and tab responses', () => {
    expect(
      specFluidTabsToViews({
        entity: { id: '42', type: 'FamixJavaClass', name: 'Collection' },
        tabs: [{ key: 'miInspectionFame:', title: 'Fame', order: 3 }],
      }),
    ).toEqual({
      object: { id: '42', type: 'FamixJavaClass', label: 'Collection' },
      views: [{ key: 'miInspectionFame:', title: 'Fame', priority: 3 }],
    });
    const view = specFluidTabToView({ key: 'miInspectionFame:', title: 'Fame', order: 3, root: fameTab });
    expect(viewResponseSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({ key: 'miInspectionFame:', priority: 3, view: { kind: 'composite' } });
  });
});

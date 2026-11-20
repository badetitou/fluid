import { describe, expect, it } from 'vitest';
import { VIEW_NODE_KINDS, viewNodeSchema, type ViewNode, type ViewNodeKind } from './nodes';

const ref = { id: 'c1', type: 'Class' };

const EXAMPLES: Record<ViewNodeKind, ViewNode> = {
  list: { kind: 'list', items: [{ cells: [{ text: 'Collection' }], ref }], total: 120 },
  columnedList: {
    kind: 'columnedList',
    columns: [{ title: 'Method' }, { title: 'Lines' }],
    items: [{ cells: [{ text: 'size', ref: { id: 'm1' } }, { text: '3' }] }],
    truncated: true,
  },
  tree: {
    kind: 'tree',
    roots: [
      { cells: [{ text: 'Collections' }], children: [{ cells: [{ text: 'Abstract' }], hasChildren: true }] },
      { cells: [{ text: 'Kernel' }], hasChildren: true },
    ],
    lazy: false,
  },
  text: { kind: 'text', text: 'size\n\t^ tally', language: 'smalltalk', highlights: [{ start: 0, end: 4 }] },
  svg: { kind: 'svg', svg: '<svg/>', hotspots: [{ ref, x: 0, y: 0, width: 10, height: 10 }] },
  label: { kind: 'label', text: 'Commit ' },
  composite: { kind: 'composite', direction: 'row', children: [{ kind: 'label', text: 'a' }] },
  tabs: { kind: 'tabs', tabs: [{ title: 'Source', node: { kind: 'text', text: '' } }], selected: 0 },
  diff: { kind: 'diff', before: 'a', after: 'b', beforeLabel: 'parent' },
  forward: { kind: 'forward', ref, view: 'methods' },
  unsupported: { kind: 'unsupported', type: 'SpRoassalInspectorPresenter', message: 'animated canvas' },
};

describe('viewNodeSchema', () => {
  it.each(VIEW_NODE_KINDS)('accepts a %s node', (kind) => {
    const result = viewNodeSchema.safeParse(EXAMPLES[kind]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(EXAMPLES[kind]);
  });

  it('accepts nodes nested in composites and tabs', () => {
    const nested: ViewNode = {
      kind: 'tabs',
      tabs: VIEW_NODE_KINDS.map((kind) => ({
        title: kind,
        node: { kind: 'composite', direction: 'column', children: [EXAMPLES[kind]] },
      })),
    };
    expect(viewNodeSchema.safeParse(nested).success).toBe(true);
  });

  it('reads a node of an unknown kind as unsupported, at any depth', () => {
    expect(viewNodeSchema.parse({ kind: 'heatmap', cells: [[1, 2]] })).toEqual({ kind: 'unsupported', type: 'heatmap' });
    expect(
      viewNodeSchema.parse({
        kind: 'tabs',
        tabs: [{ title: 'New', node: { kind: 'composite', direction: 'row', children: [{ kind: 'timeline' }] } }],
      }),
    ).toEqual({
      kind: 'tabs',
      tabs: [{ title: 'New', node: { kind: 'composite', direction: 'row', children: [{ kind: 'unsupported', type: 'timeline' }] } }],
    });
  });

  it('keeps the path of an error inside a node of a known kind', () => {
    const result = viewNodeSchema.safeParse({ kind: 'composite', direction: 'row', children: [{ kind: 'list' }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path.join('.')).toContain('children.0');
  });

  it.each([
    ['a kind that is not a string', { kind: 3 }],
    ['no kind', { text: 'hello' }],
    ['a missing field', { kind: 'columnedList', items: [] }],
    ['an empty ref id', { kind: 'forward', ref: { id: '' } }],
    ['a negative selected tab', { kind: 'tabs', tabs: [], selected: -1 }],
    ['a negative total', { kind: 'list', items: [], total: -3 }],
    ['a bad direction', { kind: 'composite', direction: 'diagonal', children: [] }],
    ['an invalid child', { kind: 'composite', direction: 'row', children: [{ kind: 'label' }] }],
    ['a tree item without cells', { kind: 'tree', roots: [{ children: [] }] }],
    ['a text range ending before it starts', { kind: 'text', text: 'abc', highlights: [{ start: 2, end: 1 }] }],
  ])('rejects %s', (_name, node) => {
    expect(viewNodeSchema.safeParse(node).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { GraphExplorerWidget } from '@fluid/shared';
import type { HierarchyDraft } from './hierarchyModel';
import { layoutHierarchy } from './hierarchyLayout';

const widget: GraphExplorerWidget = { id: 'e', type: 'graphExplorer', data: { query: 'q' } };
const root: HierarchyDraft = {
  key: 'h:root',
  label: 'All',
  kind: 'root',
  row: {},
  children: Array.from({ length: 10 }, (_, i) => `leaf-${i}`),
  count: 10,
  depth: 0,
};
const drafts = new Map<string, HierarchyDraft>([
  [root.key, root],
  ...root.children.map((key): [string, HierarchyDraft] => [
    key,
    { key, label: key, kind: 'leaf', row: { id: key }, parent: root.key, children: [], count: 1, depth: 1 },
  ]),
]);

describe('hierarchy layout', () => {
  it('packs thousands of leaves inside their parent box without overlapping', () => {
    const { nodes, bounds } = layoutHierarchy(drafts, new Set(drafts.keys()), new Set(), widget);
    expect(nodes).toHaveLength(11);
    const box = nodes[0];
    expect(nodes.slice(1).every((leaf) => leaf.x >= box.x && leaf.x + leaf.width <= box.x + box.width)).toBe(true);
    expect(bounds.maxY).toBeGreaterThan(box.y + box.height - 1);
  });
});

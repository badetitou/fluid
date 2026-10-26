import { describe, expect, it } from 'vitest';
import { boxesExample, type BoxesWidget } from '@fluid/shared';
import { boxClasses } from './boxesFixture';
import { buildBoxes, emptyReason, layoutKind, MAX_BOXES } from './boxesModel';
import { boxSizes, MAX_SIDE, MIN_SIDE } from './boxesGeometry';
import { layoutBoxes } from './boxesLayout';
import { squarify } from './treemapLayout';

const widget = boxesExample.widgets[0] as BoxesWidget;
const model = buildBoxes(boxClasses, widget);

describe('buildBoxes', () => {
  it('builds one box per row with metrics, group and parent', () => {
    expect(model.order).toEqual(['1', '2', '3', '4', '5']);
    const set = model.items.get('3')!;
    expect(set).toMatchObject({ label: 'Set', group: 'Collections', parent: '2', width: 4, height: 40, color: 900 });
    expect(model.roots).toEqual(['1']);
    expect(model.items.get('1')!.descendants).toBe(4);
    expect(model.groups).toEqual(['Collections', 'Kernel']);
  });

  it('reads a numeric color as sequential and text as categorical, unless forced', () => {
    expect(model.color).toEqual({ kind: 'sequential', field: 'numberOfLinesOfCode', min: 50, max: 900 });
    const byPackage = buildBoxes(boxClasses, { ...widget, colorField: 'parentPackage.name' });
    expect(byPackage.color).toMatchObject({ kind: 'categorical', categories: ['Kernel', 'Collections'] });
    expect(buildBoxes(boxClasses, { ...widget, colorScale: 'categorical' }).color.kind).toBe('categorical');
  });

  it('breaks cycles and ignores unknown parents', () => {
    const rows = [
      { id: 'a', name: 'A', parent: 'b' },
      { id: 'b', name: 'B', parent: 'a' },
      { id: 'c', name: 'C', parent: 'zzz' },
    ];
    const cyc = buildBoxes(rows, { parentField: 'parent' });
    expect(cyc.roots.sort()).toEqual(['b', 'c']);
    expect(cyc.items.get('a')!.parent).toBe('b');
  });

  it('keys rows without id by position and drops duplicates', () => {
    expect(buildBoxes([{ name: 'x' }, { name: 'y' }], {}).order).toEqual(['#0', '#1']);
    expect(buildBoxes([{ id: 1 }, { id: 1 }], {}).order).toEqual(['1']);
  });
});

describe('layout choice and limits', () => {
  it('defaults to tree with a parent field, else flow', () => {
    expect(layoutKind({ parentField: 'p' })).toBe('tree');
    expect(layoutKind({})).toBe('flow');
    expect(layoutKind({ boxLayout: 'treemap', parentField: 'p' })).toBe('treemap');
  });

  it('explains an empty or oversized input', () => {
    expect(emptyReason(buildBoxes([], {}))).toMatch(/No boxes/);
    const many = Array.from({ length: MAX_BOXES + 1 }, (_, i) => ({ id: i }));
    expect(emptyReason(buildBoxes(many, {}))).toMatch(/Too many boxes/);
    expect(emptyReason(model)).toBeNull();
  });
});

describe('boxSizes', () => {
  it('scales width and height between the bounds, fixed without metric', () => {
    const sizes = boxSizes(model, widget);
    expect(sizes.get('3')).toEqual({ w: MAX_SIDE, h: MAX_SIDE });
    expect(sizes.get('1')!.w).toBe(MIN_SIDE);
    const fixed = boxSizes(model, {});
    expect(fixed.get('1')).toEqual(fixed.get('3'));
  });
});

describe('layouts', () => {
  it('draws the tree with an edge per child and no overlap among siblings', () => {
    const layout = layoutBoxes(model, widget, 800, 400);
    expect(layout.boxes).toHaveLength(5);
    expect(layout.edges).toHaveLength(4);
    const set = layout.boxes.find((b) => b.key === '3')!;
    const bag = layout.boxes.find((b) => b.key === '4')!;
    expect(set.x + set.w <= bag.x || bag.x + bag.w <= set.x).toBe(true);
  });

  it('flows boxes in one titled frame per group', () => {
    const flow = layoutBoxes(model, { ...widget, parentField: undefined, boxLayout: 'flow' }, 600, 400);
    expect(flow.frames.map((f) => f.title).sort()).toEqual(['Collections', 'Kernel']);
    expect(flow.edges).toHaveLength(0);
  });

  it('fills the view with the treemap, areas proportional to the size', () => {
    const tm = layoutBoxes(model, { ...widget, boxLayout: 'treemap', sizeField: 'numberOfMethods' }, 400, 300);
    expect(tm.width).toBe(400);
    const leaves = tm.boxes.filter((b) => !b.container);
    expect(leaves.length).toBeGreaterThan(0);
    for (const b of tm.boxes) expect(b.x + b.w).toBeLessThanOrEqual(400.001);
  });

  it('squarify splits a rectangle without losing area', () => {
    const rects = squarify([6, 3, 1], { x: 0, y: 0, w: 100, h: 50 });
    const area = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(area).toBeCloseTo(5000, 3);
    expect(rects[0].w * rects[0].h).toBeGreaterThan(rects[1].w * rects[1].h);
  });
});

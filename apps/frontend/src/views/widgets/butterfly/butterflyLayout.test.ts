import { describe, expect, it } from 'vitest';
import { butterflyExample, type ButterflyWidget } from '@fluid/shared';
import { buildButterfly, CENTER_ID } from './butterflyModel';
import { BOX, columnsOf, layoutButterfly, strokeWidth, truncate } from './butterflyLayout';
import { centerMethod } from './butterflyFixture';

const spec = butterflyExample.widgets[0] as ButterflyWidget;
const butterfly = buildButterfly(centerMethod, spec)!;

describe('butterflyLayout', () => {
  it('lays out callers, center and callees in three columns, each centered vertically', () => {
    expect(columnsOf(butterfly)).toEqual([['in1:2:1', 'in1:2:2'], [CENTER_ID], ['out1:2:3', 'out1:2:5', 'out1:2:4']]);
    const layout = layoutButterfly(butterfly, 600);
    expect(layout.width).toBe(600);
    const center = layout.boxes.get(CENTER_ID)!;
    const caller = layout.boxes.get('in1:2:1')!;
    const callee = layout.boxes.get('out1:2:3')!;
    expect(caller.x).toBeLessThan(center.x);
    expect(callee.x).toBeGreaterThan(center.x);
    expect(center.y + center.height / 2).toBeCloseTo(layout.height / 2);
    expect(layout.height).toBe(3 * BOX.height + 2 * BOX.gap + 2 * BOX.padding);
  });

  it('draws arrows from the right side of a box to the left side of the next', () => {
    const layout = layoutButterfly(butterfly, 600);
    const edge = layout.edges.find((e) => e.source === 'in1:2:1')!;
    const from = layout.boxes.get('in1:2:1')!;
    const to = layout.boxes.get(CENTER_ID)!;
    expect(edge.path.startsWith(`M ${from.x + from.width} ${from.y + from.height / 2}`)).toBe(true);
    expect(edge.path.endsWith(`${to.x} ${to.y + to.height / 2}`)).toBe(true);
    expect(edge.strokeWidth).toBe(strokeWidth(2));
  });

  it('adds outer columns at depth 2 and widens a too narrow map', () => {
    const deep = buildButterfly({ id: 'c', calls: [{ id: 'a', calls: [{ id: 'b' }] }] }, { outgoingField: 'calls', depth: 2 })!;
    expect(columnsOf(deep)).toEqual([[], [], [CENTER_ID], ['out1:a'], ['out2:b']]);
    expect(layoutButterfly(deep, 100).width).toBe(5 * BOX.minColumn + 4 * BOX.columnGap + 2 * BOX.padding);
  });

  it('thickens repeated links slowly, and truncates long labels', () => {
    expect(strokeWidth(1)).toBe(1);
    expect(strokeWidth(4)).toBe(4);
    expect(strokeWidth(1000)).toBe(7);
    expect(truncate('printStringLimitedTo:', 8)).toBe('printSt…');
    expect(truncate('short', 8)).toBe('short');
  });
});

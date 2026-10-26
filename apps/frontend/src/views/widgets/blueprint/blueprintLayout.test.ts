import { describe, expect, it } from 'vitest';
import { blueprintExample, type BlueprintWidget } from '@fluid/shared';
import { buildBlueprint } from './blueprintModel';
import { BOX_WIDTH, boxHeight, layoutBlueprint } from './blueprintLayout';
import { orderedCollection } from './blueprintFixture';

const spec = blueprintExample.widgets[0] as BlueprintWidget;
const layout = layoutBlueprint(buildBlueprint(orderedCollection, spec));
const box = (label: string) => layout.boxes.find((b) => b.label === label)!;

describe('layoutBlueprint', () => {
  it('draws the five layers, the internal implementation over its depth columns', () => {
    expect(layout.columns.map((c) => c.title)).toEqual([
      'Initialization',
      'External interface',
      'Internal implementation',
      'Accessors',
      'Attributes',
    ]);
    const internal = layout.columns[2];
    expect(internal.width).toBeGreaterThan(BOX_WIDTH * 2);
    expect(box('makeRoomAtLast').x).toBeLessThan(box('growAtLast').x);
    expect(box('growAtLast').x).toBeLessThan(box('firstIndex').x);
  });

  it('stacks the boxes of a column, sorted by name, height after the lines of code', () => {
    const external = ['add:', 'addLast:', 'isEmpty', 'removeFirst'].map(box);
    expect(new Set(external.map((b) => b.x)).size).toBe(1);
    expect(external.map((b) => b.y)).toEqual([...external.map((b) => b.y)].sort((a, b) => a - b));
    expect(box('growAtLast').height).toBe(boxHeight(12));
    expect(boxHeight(undefined)).toBeLessThan(boxHeight(20));
    expect(boxHeight(10_000)).toBe(boxHeight(1_000));
  });

  it('draws calls to the right, and accesses to the attributes', () => {
    const call = layout.edges.find((e) => e.from === 'm:2:5' && e.to === 'm:2:7')!;
    expect(call.kind).toBe('call');
    expect(call.d.startsWith(`M${box('makeRoomAtLast').x + BOX_WIDTH},`)).toBe(true);
    expect(layout.edges.filter((e) => e.kind === 'access')).toHaveLength(8);
    // add: and addLast: share a column: the arrow loops on the right
    const back = layout.edges.find((e) => e.from === 'm:2:2')!;
    expect(back.d).toMatch(new RegExp(`${box('addLast:').x + BOX_WIDTH},[\\d.]+$`));
    expect(layout.width).toBeGreaterThan(box('array').x + BOX_WIDTH);
    expect(layout.height).toBeGreaterThan(box('removeFirst').y);
  });
});

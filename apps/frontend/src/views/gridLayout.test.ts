import { describe, it, expect } from 'vitest';
import type { Widget } from '@fluid/shared';
import { applyLayout, collides, compact, placeBox, resolveLayout, type Box } from './gridLayout';

function stat(id: string, extra: Partial<Widget> = {}): Widget {
  return {
    id,
    type: 'statistic',
    data: { query: 'q' },
    value: { op: 'count' },
    ...extra,
  } as Widget;
}

function noOverlap(boxes: Box[]) {
  for (const a of boxes) for (const b of boxes) if (a !== b) expect(collides(a, b)).toBe(false);
}

describe('resolveLayout', () => {
  it('flows widgets without a layout by span, left to right', () => {
    const boxes = resolveLayout([
      stat('a', { span: 12 }),
      stat('b', { span: 12 }),
      stat('c', { span: 24 }),
    ]);
    expect(boxes).toEqual([
      { id: 'a', x: 0, y: 0, w: 6, h: 3 },
      { id: 'b', x: 6, y: 0, w: 6, h: 3 },
      { id: 'c', x: 0, y: 3, w: 12, h: 3 },
    ]);
  });

  it('keeps hand-placed widgets and pushes overlapping ones down', () => {
    const boxes = resolveLayout([
      stat('a', { layout: { x: 0, y: 0, w: 6, h: 4 } }),
      stat('b', { layout: { x: 3, y: 2, w: 6, h: 4 } }),
      stat('c'),
    ]);
    noOverlap(boxes);
    expect(boxes.find((b) => b.id === 'a')).toMatchObject({ x: 0, y: 0 });
    expect(boxes.find((b) => b.id === 'b')).toMatchObject({ x: 3, y: 4 });
    expect(boxes.find((b) => b.id === 'c')!.y).toBeGreaterThanOrEqual(8);
  });
});

describe('placeBox', () => {
  const grid: Box[] = [
    { id: 'a', x: 0, y: 0, w: 6, h: 4 },
    { id: 'b', x: 6, y: 0, w: 6, h: 4 },
    { id: 'c', x: 0, y: 4, w: 12, h: 4 },
  ];

  it('swaps with the neighbour a widget is dropped onto', () => {
    const next = placeBox(grid, { ...grid[0], x: 6 }, grid[0]);
    expect(next.find((b) => b.id === 'a')).toMatchObject({ x: 6, y: 0 });
    expect(next.find((b) => b.id === 'b')).toMatchObject({ x: 0, y: 0 });
    noOverlap(next);
  });

  it('pushes widgets down when one grows over them', () => {
    const next = placeBox(grid, { ...grid[0], h: 6 });
    expect(next.find((b) => b.id === 'c')).toMatchObject({ y: 6 });
    noOverlap(next);
  });

  it('keeps a widget inside the grid', () => {
    const next = placeBox(grid, { ...grid[2], x: 5, y: -3 });
    expect(next.find((b) => b.id === 'c')).toMatchObject({ x: 0, y: 0 });
    noOverlap(next);
  });

  it('leaves a widget where it is dropped, gaps included', () => {
    const next = placeBox(grid, { ...grid[2], y: 10 }, grid[2]);
    expect(next.find((b) => b.id === 'c')).toMatchObject({ y: 10 });
  });
});

describe('compact', () => {
  it('closes the gaps', () => {
    expect(compact([{ id: 'a', x: 0, y: 5, w: 4, h: 2 }])).toEqual([
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
    ]);
  });
});

describe('applyLayout', () => {
  it('writes boxes onto widgets and drops widgets without one', () => {
    const widgets = applyLayout([stat('a'), stat('b')], [{ id: 'a', x: 1, y: 2, w: 3, h: 4 }]);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].layout).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});

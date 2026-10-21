import { describe, expect, it } from 'vitest';
import type { ScatterWidget } from '@fluid/shared';
import {
  buildAxis,
  buildLayout,
  buildPoints,
  jitterOffset,
  logTicks,
  niceTicks,
  radiusScale,
  tooltipColumns,
  transformValue,
} from './scatterModel';

const classes = [
  { id: 'a', name: 'Array', methods: 40, attributes: 2, pkg: { name: 'Collections' } },
  { id: 'b', name: 'Bag', methods: '12', attributes: 1, pkg: { name: 'Collections' } },
  { id: 'c', title: 'Color', methods: 25, attributes: 4, pkg: null },
  { id: 'd', name: 'Broken', methods: null, attributes: 3 },
];

describe('buildPoints', () => {
  it('makes one dot per row with numeric coordinates, labelled like tree nodes', () => {
    const points = buildPoints(classes, { xField: 'methods', yField: 'attributes' });
    expect(points.map((p) => [p.label, p.x, p.y])).toEqual([
      ['Array', 40, 2],
      ['Bag', 12, 1],
      ['Color', 25, 4],
    ]);
  });

  it('reads the label, category and size from the configured fields', () => {
    const [array, , color] = buildPoints(classes, {
      xField: 'methods',
      yField: 'attributes',
      labelField: 'id',
      colorField: 'pkg.name',
      sizeField: 'attributes',
    });
    expect(array).toMatchObject({ label: 'a', category: 'Collections', size: 2 });
    expect(color.category).toBe('Unknown');
  });
});

describe('axes', () => {
  it('picks round ticks', () => {
    expect(niceTicks(0, 40)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('puts 0 and powers of ten on log axes', () => {
    expect(logTicks(1000)).toEqual([0, 1, 10, 100, 1000]);
    expect(logTicks(30)).toEqual([0, 1, 2, 5, 10, 20]);
    expect(transformValue(0, 'log')).toBe(0);
    expect(transformValue(9, 'log')).toBe(1);
  });

  it('maps the domain, from 0, onto the pixel range', () => {
    const axis = buildAxis([10, 40], 'linear', 0, 100);
    expect(axis.toPixel(0)).toBe(0);
    expect(axis.toPixel(40)).toBeGreaterThan(90);
    expect(axis.toPixel(40)).toBeLessThan(100);
    // An inverted range (vertical axis) grows upwards.
    expect(buildAxis([10], 'linear', 100, 0).toPixel(10)).toBeLessThan(buildAxis([10], 'linear', 100, 0).toPixel(0));
  });
});

describe('buildLayout', () => {
  const points = buildPoints(classes, { xField: 'methods', yField: 'attributes', colorField: 'pkg.name' });

  it('places the dots inside the plot area and colors them by category', () => {
    const layout = buildLayout(points, {}, 400, 300);
    for (const p of layout.points) {
      expect(p.cx).toBeGreaterThanOrEqual(layout.plot.left);
      expect(p.cx).toBeLessThanOrEqual(layout.plot.right);
      expect(p.cy).toBeGreaterThanOrEqual(layout.plot.top);
      expect(p.cy).toBeLessThanOrEqual(layout.plot.bottom);
    }
    expect(layout.categories.map((c) => c.name)).toEqual(['Collections', 'Unknown']);
    expect(layout.points[0].color).toBe(layout.points[1].color);
    expect(layout.points[0].color).not.toBe(layout.points[2].color);
  });

  it('jitters dots deterministically', () => {
    const a = buildLayout(points, { jitter: true }, 400, 300);
    const b = buildLayout(points, { jitter: true }, 400, 300);
    const plain = buildLayout(points, {}, 400, 300);
    expect(a.points.map((p) => p.cx)).toEqual(b.points.map((p) => p.cx));
    expect(a.points.map((p) => p.cx)).not.toEqual(plain.points.map((p) => p.cx));
    expect(Math.abs(jitterOffset('x', 1))).toBeLessThanOrEqual(1);
  });

  it('scales radii between the base size and three times it', () => {
    const sized = buildPoints(classes, { xField: 'methods', yField: 'attributes', sizeField: 'attributes' });
    const radius = radiusScale(sized, 4);
    expect(radius(sized[2])).toBe(12);
    expect(radius(sized[1])).toBeGreaterThan(4);
    expect(radiusScale(points, 4)(points[0])).toBe(4);
  });
});

describe('tooltipColumns', () => {
  const widget: ScatterWidget = { id: 's', type: 'scatter', data: { query: 'q' }, xField: 'methods', yField: 'attributes', xTitle: 'Methods' };

  it('defaults to the x and y values', () => {
    expect(tooltipColumns(widget)).toEqual([
      { key: 'methods', title: 'Methods' },
      { key: 'attributes', title: undefined },
    ]);
  });

  it('uses the configured fields, even none', () => {
    expect(tooltipColumns({ ...widget, tooltipFields: [] })).toEqual([]);
  });
});

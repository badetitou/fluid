import { describe, expect, it } from 'vitest';
import { boxesExample, type BoxesWidget } from '@fluid/shared';
import { effectiveBoxesWidget, metricFields } from './boxesConfig';
import { metricLabel } from './boxesMetrics';

const widget = boxesExample.widgets[0] as BoxesWidget;

// What `model-graphql` answers to the curated System complexity query.
const boxClass = {
  __typename: 'Class',
  key: 'c1',
  name: 'Animal',
  kind: 'CLASS',
  parent: { name: 'Foo.ts' },
  methods: { totalCount: 1 },
  fields: { totalCount: 1 },
  callers: { totalCount: 0 },
  callees: { totalCount: 0 },
  references: { totalCount: 0 },
  subclasses: { totalCount: 1 },
  supertypes: { nodes: [] },
};

describe('boxes configuration', () => {
  it('follows the spec without overrides', () => {
    const effective = effectiveBoxesWidget(widget, {});
    expect(effective.widthField).toBe(widget.widthField);
    expect(effective.heightField).toBe(widget.heightField);
    expect(effective.colorField).toBe(widget.colorField);
  });

  it('remaps the metrics and the layout', () => {
    const effective = effectiveBoxesWidget(widget, {
      widthField: 'numberOfMethods',
      heightField: 'numberOfAttributes',
      boxLayout: 'treemap',
    });
    expect(effective.widthField).toBe('numberOfMethods');
    expect(effective.heightField).toBe('numberOfAttributes');
    expect(effective.boxLayout).toBe('treemap');
    expect(effective.colorField).toBe(widget.colorField);
  });

  it('turns a metric off and clears its scale', () => {
    const effective = effectiveBoxesWidget(widget, { colorField: null, widthField: null });
    expect(effective.colorField).toBeUndefined();
    expect(effective.colorScale).toBeUndefined();
    expect(effective.widthField).toBeUndefined();
  });

  it('finds numeric paths across nested rows, ignoring ids and labels', () => {
    const rows = [
      {
        id: '1',
        key: '1',
        name: 'A',
        fields: { totalCount: 2 },
        methods: { totalCount: 4 },
        parent: { name: 'business' },
        calls: { nodes: [{ to: { key: '2', weight: '7' } }] },
      },
      { id: '2', key: '2', name: 'B', fields: { totalCount: 3 } },
    ];
    expect(metricFields(rows)).toEqual([
      'calls.nodes.to.weight',
      'fields.totalCount',
      'methods.totalCount',
    ]);
  });

  it('accepts a bound object holding a list of rows', () => {
    expect(metricFields({ classes: { nodes: [{ methods: { totalCount: 5 } }] } })).toEqual(['classes.nodes.methods.totalCount']);
  });

  it("names a generic count by the alias that holds it, as in Model's connections", () => {
    expect(metricFields(boxClass).map(metricLabel)).toEqual([
      'Callees',
      'Callers',
      'Fields',
      'Methods',
      'References',
      'Subclasses',
    ]);
    expect(metricLabel('totalCount')).toBe('Total Count');
    expect(metricLabel('numberOfMethods')).toBe('Number Of Methods');
  });
});

import { describe, expect, it } from 'vitest';
import { WIDGET_TYPES, type Widget } from '@fluid/shared';
import { fromFormValues, toFormValues, widgetOptions } from './options';

const bar: Widget = {
  id: 'bar',
  type: 'bar',
  title: 'By species',
  data: { query: 'main', path: 'characters.results', transform: { groupBy: 'species' } },
  xField: 'species',
  yField: 'count',
  layout: { x: 0, y: 0, w: 6, h: 4 },
};

const byKey = (type: Widget['type']) => new Map(widgetOptions(type).map((f) => [f.key, f]));

describe('widgetOptions', () => {
  it.each(WIDGET_TYPES)('describes the %s widget, binding first and without placement', (type) => {
    const keys = widgetOptions(type).map((f) => f.key);
    expect(keys.slice(0, 3)).toEqual(['data.query', 'data.path', 'data.transform']);
    expect(keys[3]).toBe('title');
    for (const hidden of ['id', 'type', 'layout', 'span', 'height', 'data']) expect(keys).not.toContain(hidden);
  });

  it('picks an editor from the schema of each option', () => {
    const scatter = byKey('scatter');
    expect(scatter.get('xField')).toMatchObject({ kind: 'field', required: true });
    expect(scatter.get('xTitle')).toMatchObject({ kind: 'text', required: false });
    expect(scatter.get('jitter')).toMatchObject({ kind: 'boolean' });
    expect(scatter.get('pointSize')).toMatchObject({ kind: 'number', min: 2, max: 30 });
    expect(scatter.get('xScale')?.kind).toBe('select');
    expect(scatter.get('tooltipFields')?.kind).toBe('json');
    expect(byKey('table').get('pageSize')).toMatchObject({ kind: 'number', min: 1, max: undefined });
    expect(byKey('code').get('annotations')?.kind).toBe('json');
    expect(byKey('richtext').get('format')?.kind).toBe('select');
    expect(byKey('statistic').get('format')).toMatchObject({ kind: 'select', choices: ['number', 'currency', 'percent'] });
  });

  it('lists required options before optional ones and nested ones last', () => {
    const kinds = widgetOptions('scatter').slice(4);
    const lastJson = kinds.findIndex((f) => f.kind === 'json');
    expect(kinds.slice(0, 2).map((f) => f.key)).toEqual(['xField', 'yField']);
    expect(kinds.slice(lastJson).every((f) => f.kind === 'json')).toBe(true);
  });
});

describe('form values', () => {
  const fields = widgetOptions('bar');

  it('round-trips a widget', () => {
    const values = toFormValues(bar, fields);
    expect(values['data.path']).toBe('characters.results');
    expect(values['data.transform']).toBe(JSON.stringify({ groupBy: 'species' }, null, 2));
    expect(fromFormValues(bar, values, fields)).toEqual({ ok: true, widget: bar });
  });

  it('applies edits and drops cleared options, keeping the placement', () => {
    const values = { ...toFormValues(bar, fields), title: '', yField: 'avg', 'data.transform': '' };
    const result = fromFormValues(bar, values, fields);
    expect(result).toEqual({
      ok: true,
      widget: { id: 'bar', type: 'bar', data: { query: 'main', path: 'characters.results' }, xField: 'species', yField: 'avg', layout: bar.layout },
    });
  });

  it('reports invalid JSON and schema violations on their option', () => {
    expect(fromFormValues(bar, { ...toFormValues(bar, fields), 'data.transform': '{' }, fields)).toEqual({
      ok: false,
      errors: { 'data.transform': 'Invalid JSON' },
    });
    expect(fromFormValues(bar, { ...toFormValues(bar, fields), xField: '' }, fields)).toEqual({
      ok: false,
      errors: { xField: 'Required' },
    });
    const nested = fromFormValues(bar, { ...toFormValues(bar, fields), 'data.transform': '{"limit": -1}' }, fields);
    expect(!nested.ok && nested.errors['data.transform']).toMatch(/^limit: /);
  });
});

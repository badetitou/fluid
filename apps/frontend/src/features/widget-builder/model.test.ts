import { describe, expect, it } from 'vitest';
import { WIDGET_TYPES, widgetSchema, type Widget } from '@fluid/shared';
import { arrayPaths, defaultBinding, newWidget, sampleFields, uniqueWidgetId } from './model';

const results = {
  main: {
    __typename: 'Query',
    characters: {
      info: { count: 2 },
      results: [
        { id: '1', name: 'Rick', species: 'Human', episodeCount: 51, origin: { name: 'Earth' }, episode: [{ id: 'e1' }] },
        { id: '2', name: 'Morty', species: 'Human', episodeCount: 51, origin: null, episode: [] },
      ],
    },
  },
};
const queries = { main: { query: 'query { characters { results { id } } }' } };
const table: Widget = { id: 'table', type: 'table', data: { query: 'main', path: 'characters.results', transform: { limit: 5 } } };

describe('uniqueWidgetId', () => {
  it('numbers ids already taken', () => {
    expect(uniqueWidgetId('bar', [])).toBe('bar');
    expect(uniqueWidgetId('table', [table, { ...table, id: 'table-2' }])).toBe('table-3');
  });
});

describe('arrayPaths', () => {
  it('finds lists, also inside lists', () => {
    expect(arrayPaths(results.main)).toEqual(['characters.results', 'characters.results.episode']);
    expect(arrayPaths(null)).toEqual([]);
  });
});

describe('sampleFields', () => {
  it('collects scalar fields, nested objects included', () => {
    expect(sampleFields(results.main.characters.results)).toEqual({
      all: ['id', 'name', 'species', 'episodeCount', 'origin.name'],
      text: ['id', 'name', 'species', 'origin.name'],
      numeric: ['episodeCount'],
    });
  });
});

describe('defaultBinding', () => {
  it("reuses the first widget's data, without its transform", () => {
    expect(defaultBinding([table], queries, results)).toEqual({ query: 'main', path: 'characters.results' });
  });

  it("falls back to the first query's first list", () => {
    expect(defaultBinding([], queries, results)).toEqual({ query: 'main', path: 'characters.results' });
    expect(defaultBinding([], queries, {})).toEqual({ query: 'main' });
  });
});

describe('newWidget', () => {
  it.each(WIDGET_TYPES.filter((t) => t !== 'insight'))('creates a valid %s widget', (type) => {
    const widget = newWidget(type, { widgets: [table], queries, results, title: 'New' });
    expect(widgetSchema.safeParse(widget).success).toBe(true);
    expect(widget).toMatchObject({ type, title: 'New', data: { query: 'main', path: 'characters.results' } });
  });

  it('creates an insight widget reading the other widgets, without a binding of its own', () => {
    const widget = newWidget('insight', { widgets: [table], queries, results, title: 'New' });
    expect(widgetSchema.safeParse(widget).success).toBe(true);
    expect(widget).toEqual({ type: 'insight', id: expect.any(String), title: 'New' });
  });

  it('sets chart axes from the data', () => {
    expect(newWidget('bar', { widgets: [table], queries, results, title: 'Bar' })).toMatchObject({
      xField: 'name',
      yField: 'episodeCount',
    });
  });

  it('counts rows by category when there is no number to plot', () => {
    const noNumbers = { main: { characters: { results: [{ id: '1', species: 'Human' }] } } };
    expect(newWidget('pie', { widgets: [table], queries, results: noNumbers, title: 'Pie' })).toMatchObject({
      data: { query: 'main', path: 'characters.results', transform: { groupBy: 'species' } },
      colorField: 'species',
      angleField: 'count',
    });
  });

  it('stays valid when there is no data to peek at', () => {
    for (const type of WIDGET_TYPES) {
      expect(widgetSchema.safeParse(newWidget(type, { widgets: [], queries: {}, results: {}, title: 'X' })).success).toBe(true);
    }
  });
});

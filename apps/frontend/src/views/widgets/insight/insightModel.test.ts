import { describe, expect, it } from 'vitest';
import { characterInsightExample, type InsightWidget } from '@fluid/shared';
import { resolveBinding } from '../../data';
import { buildInsightRequest, compactSources, compactValue, insightKey, sourceWidgets } from './insightModel';

const view = characterInsightExample;
const self = view.widgets.find((w) => w.type === 'insight') as InsightWidget;
const characters = Array.from({ length: 20 }, (_, i) => ({
  __typename: 'Character',
  id: String(i + 1),
  name: `Character ${i + 1}`,
  species: i < 14 ? 'Human' : 'Alien',
  status: i % 3 === 0 ? 'Dead' : 'Alive',
  origin: { name: 'Earth' },
  episode: Array.from({ length: i + 1 }, (_, e) => ({ id: String(e) })),
}));
const results = { characters: { characters: { results: characters } } };
const resolve = (b: Parameters<typeof resolveBinding>[0]) => resolveBinding(b, results);

describe('compactValue', () => {
  it('cuts long lists, long texts and drops __typename', () => {
    const compact = compactValue([{ __typename: 'X', text: 'a'.repeat(500) }, 2, 3], 2) as unknown[];
    expect(compact).toHaveLength(3);
    expect(compact[2]).toBe('… 1 more');
    expect(compact[0]).toEqual({ text: `${'a'.repeat(240)}…` });
  });

  it('cuts objects with too many fields', () => {
    const wide = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`f${i}`, i]));
    const compact = compactValue(wide, 10) as Record<string, unknown>;
    expect(Object.keys(compact)).toHaveLength(41);
    expect(compact['…']).toBe('5 more fields');
  });

  it('summarises what is nested too deep', () => {
    expect(compactValue({ a: { b: { c: { d: [1, 2] } } } }, 10)).toEqual({ a: { b: { c: { d: '[2 items]' } } } });
  });
});

describe('sourceWidgets', () => {
  it('reads every other widget by default, never another insight', () => {
    const withTwin = { ...view, widgets: [...view.widgets, { ...self, id: 'twin' }] };
    expect(sourceWidgets(withTwin, self).map((w) => w.id)).toEqual(['species', 'roster']);
  });

  it('reads 20 widgets at most', () => {
    const table = view.widgets.find((w) => w.id === 'roster')!;
    const crowded = { ...view, widgets: [...Array.from({ length: 25 }, (_, i) => ({ ...table, id: `t${i}` })), self] };
    expect(sourceWidgets(crowded, self)).toHaveLength(20);
  });

  it('keeps only the listed sources', () => {
    expect(sourceWidgets(view, { ...self, sources: ['roster'] }).map((w) => w.id)).toEqual(['roster']);
  });
});

describe('buildInsightRequest', () => {
  it('sends what each widget shows, transformed, with its row count', () => {
    const request = buildInsightRequest(view, self, resolve)!;
    expect(request.focus).toBe(self.focus);
    expect(request.view.concept).toBe('Character');
    const [species, roster] = request.sources;
    expect(species).toMatchObject({ id: 'species', type: 'pie', rowCount: 2 });
    expect(species.data).toEqual([
      { species: 'Human', count: 14 },
      { species: 'Alien', count: 6 },
    ]);
    expect(roster).toMatchObject({ id: 'roster', rowCount: 20 });
  });

  it('is null when no source has data yet', () => {
    expect(buildInsightRequest(view, self, () => undefined)).toBeNull();
  });

  it('adds its own data binding as an extra source', () => {
    const request = buildInsightRequest(view, { ...self, sources: [], data: { query: 'characters' } }, resolve)!;
    expect(request.sources.map((s) => s.type)).toEqual(['data']);
  });
});

describe('compactSources', () => {
  it('samples fewer rows until the request fits the budget', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, text: 'x'.repeat(100) }));
    const sources = compactSources([{ id: 't', type: 'table', value: rows }], 3_000);
    expect(sources[0].rowCount).toBe(100);
    expect((sources[0].data as unknown[]).length).toBe(16);
    expect(JSON.stringify(sources).length).toBeLessThanOrEqual(3_000);
  });

  it('leaves out the data of the last sources when sampling is not enough', () => {
    const huge = (id: string) => ({ id, type: 'descriptions', value: { text: 'x'.repeat(200), more: 'y'.repeat(200) } });
    const sources = compactSources([huge('a'), huge('b'), huge('c')], 1_200);
    expect(JSON.stringify(sources).length).toBeLessThanOrEqual(1_200);
    expect(sources.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(sources[2].data).toBe('(left out: the request is too large)');
    expect(sources[0].data).not.toBe('(left out: the request is too large)');
  });

  it('keeps an empty list, with its count', () => {
    expect(compactSources([{ id: 't', type: 'table', value: [] }])).toEqual([{ id: 't', type: 'table', rowCount: 0, data: [] }]);
  });
});

describe('insightKey', () => {
  it('is stable for the same request and changes with the data or the focus', () => {
    const a = buildInsightRequest(view, self, resolve)!;
    expect(insightKey(a)).toBe(insightKey(structuredClone(a)));
    expect(insightKey({ ...a, focus: 'other' })).not.toBe(insightKey(a));
  });
});

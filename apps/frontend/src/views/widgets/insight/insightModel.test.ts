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

  it('summarises what is nested too deep', () => {
    expect(compactValue({ a: { b: { c: { d: [1, 2] } } } }, 10)).toEqual({ a: { b: { c: { d: '[2 items]' } } } });
  });
});

describe('sourceWidgets', () => {
  it('reads every other widget by default, never another insight', () => {
    const withTwin = { ...view, widgets: [...view.widgets, { ...self, id: 'twin' }] };
    expect(sourceWidgets(withTwin, self).map((w) => w.id)).toEqual(['species', 'roster']);
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
    const [source] = compactSources([{ id: 't', type: 'table', value: rows }], 3_000);
    expect(source.rowCount).toBe(100);
    expect((source.data as unknown[]).length).toBeLessThanOrEqual(16);
  });
});

describe('insightKey', () => {
  it('is stable for the same request and changes with the data', () => {
    const a = buildInsightRequest(view, self, resolve)!;
    expect(insightKey(a)).toBe(insightKey(structuredClone(a)));
    expect(insightKey({ ...a, focus: 'other' })).not.toBe(insightKey(a));
  });
});

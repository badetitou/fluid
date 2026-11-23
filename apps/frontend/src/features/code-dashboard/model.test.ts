import { describe, expect, it } from 'vitest';
import { analyse, hotspotOf, toFacts, type ClassFact } from './model';
import type { RawClass } from './schema';

const cls = (over: Partial<ClassFact>): ClassFact => ({
  key: over.name ?? 'k',
  name: 'A',
  file: 'A.java',
  kind: 'class',
  lines: 100,
  methods: [],
  methodCount: 0,
  referrers: 1,
  ...over,
});

describe('toFacts', () => {
  it('drops external classes and measures ranges', () => {
    const raw = (name: string, external: boolean): RawClass => ({
      key: name,
      name,
      file: null,
      external,
      fineKind: 'class',
      range: { startLine: 10, endLine: 19 },
      incoming: { totalCount: 2 },
      children: { totalCount: 1, nodes: [{ key: 'm', name: 'm', range: { startLine: 1, endLine: 5 }, incoming: { totalCount: 0 } }] },
    });
    const facts = toFacts([raw('Mine', false), raw('Lib', true)]);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ name: 'Mine', lines: 10, referrers: 2 });
    expect(facts[0].methods[0]).toEqual({ name: 'm', lines: 5, callers: 0 });
  });
});

describe('hotspotOf', () => {
  it('is zero for a small, used class', () => {
    expect(hotspotOf(cls({ lines: 80 })).score).toBe(0);
  });

  it('explains a big class', () => {
    const h = hotspotOf(cls({ lines: 900, methodCount: 40 }));
    expect(h.reasons).toEqual(['900 lines', '40 methods']);
    expect(h.score).toBeGreaterThan(1);
  });

  it('counts unused methods but spares implicit ones', () => {
    const m = (name: string, callers = 0) => ({ name, lines: 5, callers });
    const h = hotspotOf(cls({ methods: [m('helper'), m('toString'), m('used', 3), m('testFoo')] }));
    expect(h.deadMethods).toBe(1);
  });

  it('flags a class nobody references', () => {
    expect(hotspotOf(cls({ referrers: 0 })).reasons).toContain('never referenced');
  });
});

describe('analyse', () => {
  const classes = [
    cls({ name: 'Big', lines: 800, methodCount: 35, methods: [{ name: 'huge', lines: 120, callers: 1 }] }),
    cls({ name: 'Dead', lines: 40, referrers: 0 }),
    cls({ name: 'Fine', lines: 60 }),
  ];
  const d = analyse(classes);

  it('totals', () => {
    expect(d).toMatchObject({ classCount: 3, methodCount: 35, totalLines: 900 });
  });

  it('ranks the problems', () => {
    expect(d.bigClasses.map((c) => c.name)).toEqual(['Big']);
    expect(d.longMethods[0]).toMatchObject({ className: 'Big', name: 'huge' });
    expect(d.deadClasses.map((c) => c.name)).toEqual(['Dead']);
    expect(d.hotspots[0].cls.name).toBe('Big');
  });

  it('reports the healthy share and size buckets', () => {
    expect(d.healthyPercent).toBe(33);
    expect(d.sizeBuckets.find((b) => b.label === '500+')?.count).toBe(1);
    expect(d.sizeBuckets.reduce((n, b) => n + b.count, 0)).toBe(3);
  });

  it('handles an empty project', () => {
    expect(analyse([]).healthyPercent).toBe(100);
  });
});

import { describe, expect, it } from 'vitest';
import { PYRAMID_METRICS, safeParseWidgetDraft, widgetSchema } from '@fluid/shared';
import { pyramidData, pyramidSpec } from './pyramidFixture';
import { classify, emptyReason, formatMetric, formatRatio, ratioValue, readMetric, readMetrics, thresholdsFor } from './pyramidModel';

describe('pyramid metrics', () => {
  it('computes every metric of the curated example from the lists', () => {
    const values = readMetrics(pyramidData, pyramidSpec);
    expect(values).toMatchObject({ nop: null, noc: 3, nom: 3, loc: 24, cyclo: 6, calls: 6, fanout: 3 });
    expect(values.andc).toBeCloseTo(2 / 3);
    expect(values.ahh).toBeCloseTo(5 / 3);
  });

  it('reads a field of the object, or of the single row of a list', () => {
    const model = { metrics: { classes: 42 } };
    expect(readMetric(model, 'metrics.classes')).toBe(42);
    expect(readMetric([model], 'metrics.classes')).toBe(42);
    expect(readMetric(model, 'metrics.missing')).toBeNull();
    expect(readMetric({ n: 'not a number' }, 'n')).toBeNull();
  });

  it('aggregates over the bound list itself when no rows path is given', () => {
    const classes = [{ loc: 10 }, { loc: 20 }, { loc: null }];
    expect(readMetric(classes, { op: 'count' })).toBe(3);
    expect(readMetric(classes, { op: 'sum', field: 'loc' })).toBe(30);
    expect(readMetric(classes, { op: 'avg', field: 'loc' })).toBe(15);
    expect(readMetric([], { op: 'avg', field: 'loc' })).toBeNull();
  });

  it('divides neighbours into ratios, and leaves a ratio out when a term is missing or zero', () => {
    const values = readMetrics(pyramidData, pyramidSpec);
    expect(ratioValue(values, 'locNom')).toBe(8);
    expect(ratioValue(values, 'fanoutCalls')).toBe(0.5);
    expect(ratioValue({ ...values, nop: 0 }, 'nocNop')).toBeNull();
    expect(ratioValue({ ...values, calls: null }, 'callsNom')).toBeNull();
    expect(ratioValue(values, 'andc')).toBeCloseTo(2 / 3);
  });

  it('colors a value by the level it is closest to, as Moose does', () => {
    expect(classify(0.1, [0.16, 0.2, 0.24])).toBe('low');
    expect(classify(0.21, [0.16, 0.2, 0.24])).toBe('average');
    expect(classify(1, [0.16, 0.2, 0.24])).toBe('high');
  });

  it('takes the preset thresholds (Java by default) and the overrides', () => {
    const java = thresholdsFor({ ...pyramidSpec, thresholdPreset: undefined });
    expect(java.locNom).toEqual([7, 10, 13]);
    expect(thresholdsFor(pyramidSpec).ahh).toEqual([1.42, 2.22, 3.03]);
    expect(thresholdsFor({ ...pyramidSpec, thresholds: { ahh: [1, 2, 3] } }).ahh).toEqual([1, 2, 3]);
  });

  it('formats ratios truncated to two decimals and raw values with thousands', () => {
    expect(formatRatio(2 / 3)).toBe('0.66');
    expect(formatMetric(35175)).toBe('35,175');
    expect(formatMetric(1.666)).toBe('1.66');
  });

  it('explains why there is nothing to draw', () => {
    expect(emptyReason(null, readMetrics(null, pyramidSpec))).toMatch(/No data/);
    expect(emptyReason({ other: 1 }, readMetrics({ other: 1 }, pyramidSpec))).toMatch(/No metric/);
    expect(emptyReason(pyramidData, readMetrics(pyramidData, pyramidSpec))).toBeNull();
  });
});

describe('pyramid schema', () => {
  const bare = Object.fromEntries(Object.entries(pyramidSpec).filter(([key]) => !(PYRAMID_METRICS as readonly string[]).includes(key)));

  it('accepts the curated example and a single metric', () => {
    expect(widgetSchema.safeParse(pyramidSpec).success).toBe(true);
    expect(widgetSchema.safeParse({ ...bare, noc: pyramidSpec.noc }).success).toBe(true);
  });

  it('rejects a pyramid without any metric, generated or not', () => {
    const { id: _id, ...draft } = bare;
    expect(widgetSchema.safeParse(bare).success).toBe(false);
    expect(safeParseWidgetDraft(draft).success).toBe(false);
    expect(safeParseWidgetDraft({ ...draft, noc: 'numberOfClasses' }).success).toBe(true);
  });

  it('rejects a sum without field and unordered thresholds', () => {
    expect(widgetSchema.safeParse({ ...bare, loc: { rows: 'methods', op: 'sum' } }).success).toBe(false);
    expect(widgetSchema.safeParse({ ...pyramidSpec, thresholds: { ahh: [3, 2, 1] } }).success).toBe(false);
  });

  it('takes negative values for unknown, as Moose answers -1', () => {
    const data = { methods: [{ cyclo: -1 }, { cyclo: -1 }], loc: -1 };
    expect(readMetric(data, { rows: 'methods', op: 'sum', field: 'cyclo' })).toBeNull();
    expect(readMetric({ methods: [{ cyclo: -1 }, { cyclo: 3 }] }, { rows: 'methods', op: 'sum', field: 'cyclo' })).toBe(3);
    expect(readMetric({ methods: [] }, { rows: 'methods', op: 'sum', field: 'cyclo' })).toBe(0);
    expect(readMetric(data, 'loc')).toBeNull();
  });
});

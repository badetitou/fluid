import { describe, expect, it } from 'vitest';
import { MAX_FILTER_OPTIONS, clampPage, compareRows, compareValues, filterOptions, matchesFilter, pageSizeOptions } from './tableModel';

describe('compareValues', () => {
  it('orders numbers numerically and text naturally', () => {
    expect([10, 2, 33].sort(compareValues)).toEqual([2, 10, 33]);
    expect(['a10', 'a2', 'B1'].sort(compareValues)).toEqual(['a2', 'a10', 'B1']);
  });

  it('orders ISO dates chronologically', () => {
    expect(['2024-03-01', '2023-12-31'].sort(compareValues)).toEqual(['2023-12-31', '2024-03-01']);
  });

  it('puts empty values last', () => {
    expect([null, 'b', '', 'a', undefined].sort(compareValues)).toEqual(['a', 'b', null, '', undefined]);
  });
});

describe('compareRows', () => {
  it('compares the value at a dot path', () => {
    const rows = [{ c: { n: 'Zoe' } }, { c: { n: 'Al' } }];
    expect(rows.sort(compareRows('c.n')).map((r) => r.c.n)).toEqual(['Al', 'Zoe']);
  });
});

describe('filterOptions', () => {
  const rows = [{ status: 'Alive' }, { status: 'Dead' }, { status: 'Alive' }, { status: null }];

  it('lists the distinct values, sorted, empty included', () => {
    expect(filterOptions(rows, { key: 'status' })).toEqual(['Alive', 'Dead', '']);
  });

  it('flattens nested lists', () => {
    const nested = [{ tags: ['a', 'b'] }, { tags: ['c'] }];
    expect(filterOptions(nested, { key: 'tags', format: 'tag' })).toEqual(['a', 'b', 'c']);
  });

  it('offers no filter for numeric or date columns', () => {
    expect(filterOptions(rows, { key: 'status', format: 'number' })).toBeNull();
    expect(filterOptions(rows, { key: 'status', format: 'date' })).toBeNull();
  });

  it('offers no filter for a single value, objects or too many values', () => {
    expect(filterOptions([{ a: 'x' }, { a: 'x' }], { key: 'a' })).toBeNull();
    expect(filterOptions([{ a: { b: 1 } }, { a: { b: 2 } }], { key: 'a' })).toBeNull();
    const many = Array.from({ length: MAX_FILTER_OPTIONS + 1 }, (_, i) => ({ a: `v${i}` }));
    expect(filterOptions(many, { key: 'a' })).toBeNull();
  });
});

describe('matchesFilter', () => {
  it('matches scalar values, booleans, empties and any element of a list', () => {
    expect(matchesFilter({ s: 'Alive' }, 's', 'Alive')).toBe(true);
    expect(matchesFilter({ s: 'Dead' }, 's', 'Alive')).toBe(false);
    expect(matchesFilter({ ok: true }, 'ok', 'true')).toBe(true);
    expect(matchesFilter({ s: null }, 's', '')).toBe(true);
    expect(matchesFilter({ tags: ['a', 'b'] }, 'tags', 'b')).toBe(true);
  });
});

describe('pageSizeOptions', () => {
  it('offers the standard sizes', () => {
    expect(pageSizeOptions()).toEqual([8, 10, 20, 50, 100]);
  });

  it('adds a custom spec size in order, without duplicating a standard one', () => {
    expect(pageSizeOptions(5)).toEqual([5, 8, 10, 20, 50, 100]);
    expect(pageSizeOptions(20)).toEqual([8, 10, 20, 50, 100]);
  });
});

describe('clampPage', () => {
  it('keeps the page between 1 and the last page', () => {
    expect(clampPage(3, 100, 20)).toBe(3);
    expect(clampPage(9, 100, 20)).toBe(5);
    expect(clampPage(0, 100, 20)).toBe(1);
    expect(clampPage(4, 0, 20)).toBe(1);
  });
});

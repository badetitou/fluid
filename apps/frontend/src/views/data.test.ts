import { describe, it, expect } from 'vitest';
import { aggregate, applyTransform, getPath, resolveBinding, scopedResolver } from './data';

const customers = [
  {
    id: 'c1',
    fullName: 'Ada',
    accounts: [
      { iban: 'FR1', transactions: [{ amount: 10, category: 'FOOD' }, { amount: 5, category: 'RENT' }] },
      { iban: 'FR2', transactions: [{ amount: 20, category: 'FOOD' }] },
    ],
  },
  { id: 'c2', fullName: 'Alan', accounts: [{ iban: 'FR3', transactions: [] }] },
];

describe('getPath', () => {
  it('resolves plain object paths', () => {
    expect(getPath({ customer: { fullName: 'Ada' } }, 'customer.fullName')).toBe('Ada');
    expect(getPath({ a: 1 }, '')).toEqual({ a: 1 });
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
  });

  it('flattens through nested lists at any depth', () => {
    expect(getPath({ customers }, 'customers.accounts.iban')).toEqual(['FR1', 'FR2', 'FR3']);
    expect(getPath({ customers }, 'customers.accounts.transactions.amount')).toEqual([10, 5, 20]);
    expect(getPath({ customers }, 'customers.accounts.transactions')).toHaveLength(3);
  });

  it('keeps numeric segments as array indexes', () => {
    expect(getPath({ customers }, 'customers.0.accounts.1.iban')).toBe('FR2');
  });
});

describe('multi-level bindings', () => {
  it('aggregates and groups data several levels deep', () => {
    const rows = resolveBinding(
      { query: 'q', path: 'customers.accounts.transactions', transform: { groupBy: 'category', aggregate: { field: 'amount' } } },
      { q: { customers } },
    );
    expect(rows).toEqual([
      expect.objectContaining({ category: 'FOOD', count: 2, sum: 30 }),
      expect.objectContaining({ category: 'RENT', count: 1, sum: 5 }),
    ]);
    expect(aggregate(customers, 'sum', 'accounts.transactions.amount')).toBe(35);
  });

  it('sorts rows by a nested field', () => {
    const sorted = applyTransform(customers, { sort: { by: 'accounts.iban', dir: 'desc' } }) as typeof customers;
    expect(sorted.map((c) => c.id)).toEqual(['c2', 'c1']);
  });
});

describe('derive', () => {
  it('adds per-row aggregates over nested lists, usable by sort and limit', () => {
    const rows = applyTransform(customers, {
      derive: [
        { as: 'totalSpent', op: 'sum', field: 'accounts.transactions.amount' },
        { as: 'txCount', op: 'count', field: 'accounts.transactions' },
      ],
      sort: { by: 'totalSpent', dir: 'desc' },
      limit: 1,
    });
    expect(rows).toEqual([expect.objectContaining({ id: 'c1', totalSpent: 35, txCount: 3 })]);
  });
});

describe('scopedResolver', () => {
  const parent = (binding: { query: string }) => `parent:${binding.query}`;

  it('resolves a key of the bindings with the usual path and transform', () => {
    const resolve = scopedResolver({ '$node': customers[0] }, parent);
    expect(resolve({ query: '$node', path: 'fullName' })).toBe('Ada');
    expect(resolve({ query: '$node', path: 'accounts.iban', transform: { limit: 1 } })).toEqual(['FR1']);
  });

  it('delegates every other query to the parent', () => {
    expect(scopedResolver({ '$node': customers[0] }, parent)({ query: 'q' })).toBe('parent:q');
  });

  it('shadows an enclosing binding with the same key', () => {
    const outer = scopedResolver({ '$node': customers[0] }, parent);
    const inner = scopedResolver({ '$node': customers[1] }, outer);
    expect(inner({ query: '$node', path: 'fullName' })).toBe('Alan');
  });

  it('ignores inherited object properties', () => {
    const resolve = scopedResolver({}, parent);
    expect(resolve({ query: 'toString' })).toBe('parent:toString');
  });
});

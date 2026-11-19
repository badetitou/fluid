import { describe, expect, it } from 'vitest';
import { buildVariables, declaredVariables, runViewBody } from './model';

describe('declaredVariables', () => {
  it('reads the variables of the single query', () => {
    expect([...declaredVariables('query Q($take: Int, $id: ID!) { a(take: $take) }')]).toEqual(['take', 'id']);
    expect(declaredVariables('{ a }').size).toBe(0);
  });
  it('refuses mutations, subscriptions and several operations', () => {
    expect(() => declaredVariables('mutation { a }')).toThrow('Only a single query operation can run');
    expect(() => declaredVariables('subscription { a }')).toThrow('Only a single query operation can run');
    expect(() => declaredVariables('query A { a } query B { b }')).toThrow('Only a single query operation can run');
    expect(() => declaredVariables('fragment F on T { a }')).toThrow('Only a single query operation can run');
  });
  it('throws on invalid GraphQL', () => {
    expect(() => declaredVariables('not graphql {')).toThrow();
  });
});

describe('buildVariables', () => {
  const q = { query: 'x', variables: { a: 1, b: 2 } };
  const all = new Set(['a', 'b', 'take']);
  it('lets the request override the stored variables', () => {
    expect(buildVariables(q, all, { variables: { b: 3 } })).toEqual({ a: 1, b: 3 });
  });
  it('keeps only the declared variables', () => {
    expect(buildVariables(q, new Set(['a']), { variables: { c: 9 } })).toEqual({ a: 1 });
  });
  it('sets take only when the query declares it, and only from the request take', () => {
    expect(buildVariables(q, all, { take: 5 })).toEqual({ a: 1, b: 2, take: 5 });
    expect(buildVariables(q, new Set(['a']), { take: 5 })).toEqual({ a: 1 });
    expect(buildVariables(q, all, { variables: { take: 99999 } })).toEqual({ a: 1, b: 2 });
    expect(buildVariables(q, all, { variables: { take: 99999 }, take: 7 }).take).toBe(7);
  });
  it('leaves $limit and $Take alone', () => {
    expect(buildVariables(q, new Set(['limit', 'Take']), { take: 5 })).toEqual({});
  });
  it('bounds a stored take', () => {
    expect(buildVariables({ query: 'x', variables: { take: 10 ** 9 } }, all, {}).take).toBe(10_000);
  });
});

describe('runViewBody', () => {
  it('rejects unknown fields such as query', () => {
    expect(runViewBody.safeParse({ sourceId: 's', query: '{ x }' }).success).toBe(false);
    expect(runViewBody.safeParse({ sourceId: 's', take: 3 }).success).toBe(true);
  });
  it('bounds take', () => {
    for (const take of [0, 10_001, 1.5, -1]) expect(runViewBody.safeParse({ sourceId: 's', take }).success).toBe(false);
    for (const take of [1, 10_000]) expect(runViewBody.safeParse({ sourceId: 's', take }).success).toBe(true);
  });
  it('requires object variables of bounded size', () => {
    expect(runViewBody.safeParse({ sourceId: 's', variables: 'x' }).success).toBe(false);
    expect(runViewBody.safeParse({ sourceId: 's', variables: [1] }).success).toBe(false);
    expect(runViewBody.safeParse({ sourceId: 's', variables: { a: 'x'.repeat(70_000) } }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildVariables, declaredVariables, runViewBody } from './run-model';

describe('declaredVariables', () => {
  it('reads the variables of the operations', () => {
    expect([...declaredVariables('query Q($take: Int, $id: ID!) { a(take: $take) }')]).toEqual(['take', 'id']);
    expect(declaredVariables('{ a }').size).toBe(0);
  });
  it('throws on invalid GraphQL', () => {
    expect(() => declaredVariables('not graphql {')).toThrow();
  });
});

describe('buildVariables', () => {
  const q = { query: 'x', variables: { a: 1, b: 2 } };
  it('lets the request override the stored variables', () => {
    expect(buildVariables(q, new Set(), { variables: { b: 3 } })).toEqual({ a: 1, b: 3 });
  });
  it('sets take only when the query declares it', () => {
    expect(buildVariables(q, new Set(['take']), { take: 5 })).toEqual({ a: 1, b: 2, take: 5 });
    expect(buildVariables(q, new Set(), { take: 5 })).toEqual({ a: 1, b: 2 });
  });
});

describe('runViewBody', () => {
  it('rejects unknown fields such as query', () => {
    expect(runViewBody.safeParse({ sourceId: 's', query: '{ x }' }).success).toBe(false);
    expect(runViewBody.safeParse({ sourceId: 's', take: 3 }).success).toBe(true);
  });
});

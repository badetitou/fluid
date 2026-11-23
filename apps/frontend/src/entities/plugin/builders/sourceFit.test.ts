import { describe, expect, it } from 'vitest';
import { EXAMPLE_VIEWS, type ViewSpec } from '@fluid/shared';
import type { IntrospectionType } from '../../../graphql/introspection';
import { fitsSource, rootFieldsOf, type RootFields } from './sourceFit';

const root = (fields: Record<string, string[]>): IntrospectionType => ({
  kind: 'OBJECT',
  name: 'Query',
  description: null,
  fields: Object.entries(fields).map(([name, args]) => ({
    name,
    description: null,
    args: args.map((a) => ({ name: a })),
    type: { kind: 'OBJECT', name: 'X' },
  })),
});

const spec = (query: string): ViewSpec => ({ queries: { q: { query } } }) as unknown as ViewSpec;

/** The Moose root fields the Class examples are written for. */
const MOOSE = rootFieldsOf(root({ class: ['id'], classes: ['take', 'skip'], method: ['id'], methods: ['take'] })) as RootFields;
/** badetitou/Model's: by-key lookups and Relay-style lists. */
const MODEL = rootFieldsOf(root({ classByKey: ['key'], classes: ['first', 'after'], methodByKey: ['key'], stats: [] })) as RootFields;

describe('fitsSource', () => {
  it('needs every root field and argument a query uses', () => {
    expect(fitsSource(spec('query($id: ID!) { class(id: $id) { name } }'), MOOSE)).toBe(true);
    expect(fitsSource(spec('query($id: ID!) { class(id: $id) { name } }'), MODEL)).toBe(false);
    expect(fitsSource(spec('{ classes(take: 10) { name } }'), MODEL)).toBe(false);
    expect(fitsSource(spec('{ classes(first: 10) { nodes { name } } stats { entities } }'), MODEL)).toBe(true);
  });

  it('ignores introspection fields and fragment definitions, rejects a query that does not parse', () => {
    expect(fitsSource(spec('{ __typename stats { ...S } } fragment S on Stats { entities }'), MODEL)).toBe(true);
    expect(fitsSource(spec('{ stats {'), MODEL)).toBe(false);
  });

  it('keeps the Moose Class examples on Moose and drops them on a Model source', () => {
    const classExamples = EXAMPLE_VIEWS.Class;
    expect(classExamples.length).toBeGreaterThan(0);
    expect(classExamples.every((s) => fitsSource(s, MOOSE))).toBe(true);
    expect(classExamples.some((s) => fitsSource(s, MODEL))).toBe(false);
  });

  it('reads the root fields of an introspected root type, nothing before it is known', () => {
    expect(rootFieldsOf(null)).toBeUndefined();
    expect(MODEL.get('classes')).toEqual(new Set(['first', 'after']));
  });
});

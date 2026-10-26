import { describe, expect, it } from 'vitest';
import { viewSpecSchema } from '@fluid/shared';
import type { Concept } from '../../../../graphql/introspection';
import { specFluidUrl, tabPerspective, tabVariables } from './model';

const concept = { name: 'Method' } as Concept;

describe('Spec-Fluid view builder model', () => {
  it('encodes ids and tab keys in URLs', () => {
    expect(specFluidUrl('http://localhost:8081/spec-fluid/', 'entities', '1:42', 'tabs', 'miInspectionFame:')).toBe(
      'http://localhost:8081/spec-fluid/entities/1%3A42/tabs/miInspectionFame%3A',
    );
  });

  it('makes a valid detail view reading the tab from the Spec-Fluid source', () => {
    const p = tabPerspective(concept, '1:42', { key: 'miInspectionFame:', title: 'Fame', order: 3 });
    expect(p).toMatchObject({ key: 'spec-fluid:miInspectionFame:', title: 'Fame', origin: 'remote' });
    expect(viewSpecSchema.safeParse(p.spec).error?.issues ?? []).toEqual([]);
    expect(p.spec.scope).toBe('detail');
    expect(p.spec.queries.tab).toEqual({
      source: 'spec-fluid',
      query: 'tab',
      variables: { id: '1:42', tab: 'miInspectionFame:' },
    });
  });

  it('checks the variables of a tab query', () => {
    expect(tabVariables({ id: '1:42', tab: 'k' })).toEqual({ id: '1:42', tab: 'k' });
    expect(() => tabVariables({ id: 3 })).toThrow(/needs the "id"/);
  });
});

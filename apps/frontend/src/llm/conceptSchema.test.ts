import { describe, it, expect } from 'vitest';
import type { Concept, ConceptField } from '../graphql/introspection';
import { buildEntryPoints, buildRelationPaths } from './conceptSchema';

function field(name: string, typeName: string, opts: Partial<ConceptField> = {}): ConceptField {
  const isScalar = ['ID', 'String', 'Float', 'Int'].includes(typeName);
  return { name, description: null, typeName, typeKind: isScalar ? 'SCALAR' : 'OBJECT', isList: false, isScalar, ...opts };
}

function concept(name: string, fields: ConceptField[]): Concept {
  return {
    name,
    description: null,
    fields,
    scalarFields: fields.filter((f) => f.isScalar),
    relationFields: fields.filter((f) => !f.isScalar),
    queries: {},
  };
}

const customer = concept('Customer', [
  field('id', 'ID'),
  field('fullName', 'String'),
  field('accounts', 'Account', { isList: true }),
]);
const account = concept('Account', [
  field('iban', 'String'),
  field('customer', 'Customer'),
  field('transactions', 'Transaction', { isList: true }),
]);
const transaction = concept('Transaction', [
  field('amount', 'Float'),
  field('account', 'Account'),
  field('merchant', 'Merchant'),
]);
const merchant = concept('Merchant', [field('name', 'String')]);
const byName = new Map([customer, account, transaction, merchant].map((c) => [c.name, c]));

describe('buildRelationPaths', () => {
  it('walks relations several levels deep and skips back-references', () => {
    const paths = buildRelationPaths(customer, byName);
    expect(paths.map((p) => p.path)).toEqual([
      'accounts',
      'accounts.transactions',
      'accounts.transactions.merchant',
    ]);
    expect(paths[2]).toEqual({
      path: 'accounts.transactions.merchant',
      typeName: 'Merchant',
      isList: true,
      fields: ['name: String'],
    });
  });

  it('lists relations of a type to itself as recursive, without walking them', () => {
    const repository = concept('Repository', [field('name', 'String'), field('commits', 'Commit', { isList: true })]);
    const commit = concept('Commit', [
      field('message', 'String'),
      field('parentCommits', 'Commit', { isList: true }),
      field('repository', 'Repository'),
    ]);
    const paths = buildRelationPaths(repository, new Map([repository, commit].map((c) => [c.name, c])));
    expect(paths).toEqual([
      { path: 'commits', typeName: 'Commit', isList: true, fields: ['message: String'] },
      { path: 'commits.parentCommits', typeName: 'Commit', isList: true, fields: ['message: String'], recursive: true },
    ]);
  });

  it('honours the depth limit', () => {
    expect(buildRelationPaths(customer, byName, 1).map((p) => p.path)).toEqual(['accounts']);
  });
});

describe('buildEntryPoints', () => {
  it('lists each root concept with its root queries and scalar fields', () => {
    const queries = new Map([
      ['Customer', { list: { field: 'customers', limitArg: 'take' }, byId: { field: 'customer', idArg: 'id', idType: 'ID!' } }],
      ['Bank', { list: { field: 'banks', itemsPath: 'results' } }],
    ]);
    expect(buildEntryPoints(queries, byName)).toEqual([
      {
        concept: 'Bank',
        listQuery: 'banks',
        listItemsPath: 'results',
        listLimitArg: null,
        byIdQuery: null,
        byIdArgName: null,
        byIdArgType: null,
        fields: [],
      },
      {
        concept: 'Customer',
        listQuery: 'customers',
        listItemsPath: null,
        listLimitArg: 'take',
        byIdQuery: 'customer',
        byIdArgName: 'id',
        byIdArgType: 'ID!',
        fields: ['id: ID', 'fullName: String'],
      },
    ]);
  });
});

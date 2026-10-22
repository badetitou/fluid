import { describe, it, expect } from 'vitest';
import type { Concept, ConceptField } from '../graphql/introspection';
import { buildEntryPoints, buildMutationInfos, buildRelationPaths, mutationInputTypes } from './conceptSchema';

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

describe('buildMutationInfos', () => {
  const update = {
    field: 'updateTodo',
    kind: 'update' as const,
    args: [
      { name: 'id', type: 'ID!', typeName: 'ID', required: true, isInput: false },
      { name: 'input', type: 'UpdateTodoInput!', typeName: 'UpdateTodoInput', required: true, isInput: true },
    ],
    idArg: 'id',
    inputArg: 'input',
    returnsConcept: true,
  };
  const remove = { ...update, field: 'deleteTodo', kind: 'delete' as const, args: [update.args[0]], inputArg: undefined, returnsConcept: false };
  const mutations = { update, delete: remove, others: [] };

  it('lists the input types to introspect', () => {
    expect(mutationInputTypes(mutations)).toEqual(['UpdateTodoInput']);
    expect(mutationInputTypes(undefined)).toEqual([]);
  });

  it('describes each mutation with the fields of its input object', () => {
    const inputs = new Map([
      ['UpdateTodoInput', [{ name: 'title', description: null, type: 'String', typeName: 'String', typeKind: 'SCALAR', isList: false, required: false }]],
    ]);
    expect(buildMutationInfos(mutations, inputs)).toEqual([
      {
        field: 'updateTodo',
        kind: 'update',
        args: [{ name: 'id', type: 'ID!' }, { name: 'input', type: 'UpdateTodoInput!' }],
        returnsConcept: true,
        inputFields: ['title: String'],
      },
      { field: 'deleteTodo', kind: 'delete', args: [{ name: 'id', type: 'ID!' }], returnsConcept: false },
    ]);
    expect(buildMutationInfos(undefined)).toEqual([]);
  });
});

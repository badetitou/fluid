import { describe, it, expect } from 'vitest';
import { buildInputFields, buildRootMutations, classifyMutation, splitMutationName } from './mutations';
import type { IntrospectionField, IntrospectionType, TypeRef } from './introspectionTypes';

// Shaped like the deep `__type(name: "Mutation")` result of https://graphqlzero.almansi.me/api.
const nonNull = (ofType: TypeRef): TypeRef => ({ kind: 'NON_NULL', name: null, ofType });
const ID = nonNull({ kind: 'SCALAR', name: 'ID' });
const input = (name: string) => nonNull({ kind: 'INPUT_OBJECT', name });
const object = (name: string): TypeRef => ({ kind: 'OBJECT', name });
const BOOLEAN: TypeRef = { kind: 'SCALAR', name: 'Boolean' };

const field = (name: string, args: IntrospectionField['args'], type: TypeRef): IntrospectionField => ({
  name,
  description: null,
  args,
  type,
});

const mutationType: IntrospectionType = {
  kind: 'OBJECT',
  name: 'Mutation',
  description: null,
  fields: [
    field('_', [], { kind: 'SCALAR', name: 'Int' }),
    field('createTodo', [{ name: 'input', type: input('CreateTodoInput') }], object('Todo')),
    field('updateTodo', [{ name: 'id', type: ID }, { name: 'input', type: input('UpdateTodoInput') }], object('Todo')),
    field('deleteTodo', [{ name: 'id', type: ID }], BOOLEAN),
    field('completeTodo', [{ name: 'id', type: ID }], object('Todo')),
    field('setTodoTitle', [{ name: 'id', type: ID }], object('Todo')),
    field('login', [], object('Session')),
  ],
};

const concepts = new Set(['Todo', 'User']);

describe('splitMutationName', () => {
  it('reads the verb a camelCase or snake_case name starts with', () => {
    expect(splitMutationName('updateTodo')).toEqual({ kind: 'update', subject: 'Todo' });
    expect(splitMutationName('insert_todos')).toEqual({ kind: 'create', subject: 'todos' });
    expect(splitMutationName('removeUser')).toEqual({ kind: 'delete', subject: 'User' });
  });

  it('needs the verb to end at a word boundary', () => {
    expect(splitMutationName('settings').kind).toBe('other');
    expect(splitMutationName('newsletterSignup').kind).toBe('other');
  });
});

describe('classifyMutation', () => {
  it('attaches a scalar-returning mutation to the concept its name ends with', () => {
    const result = classifyMutation(mutationType.fields![3], concepts);
    expect(result).toEqual({
      concept: 'Todo',
      mutation: {
        field: 'deleteTodo',
        kind: 'delete',
        args: [{ name: 'id', type: 'ID!', typeName: 'ID', required: true, isInput: false }],
        idArg: 'id',
        returnsConcept: false,
      },
    });
  });

  it('finds the key and the input object of an update', () => {
    const result = classifyMutation(mutationType.fields![2], concepts);
    expect(result?.mutation).toMatchObject({ kind: 'update', idArg: 'id', inputArg: 'input', returnsConcept: true });
    expect(result?.mutation.args[1]).toMatchObject({ type: 'UpdateTodoInput!', typeName: 'UpdateTodoInput' });
  });

  it('takes the only required non-input argument as the key when there is no id', () => {
    const f = field('deleteCountry', [{ name: 'code', type: ID }], BOOLEAN);
    expect(classifyMutation(f, new Set(['Country']))?.mutation.idArg).toBe('code');
  });

  it('matches a plural subject', () => {
    const f = field('delete_todos', [{ name: 'where', type: input('TodoBoolExp') }], { kind: 'SCALAR', name: 'Int' });
    expect(classifyMutation(f, concepts)?.concept).toBe('Todo');
  });

  it('guesses the input argument by name when a shallow introspection hides its type', () => {
    const f = field('createTodo', [{ name: 'input', type: { kind: 'NON_NULL', name: null } }], object('Todo'));
    expect(classifyMutation(f, concepts)?.mutation).toMatchObject({ inputArg: 'input' });
  });

  it('ignores mutations writing no known concept', () => {
    expect(classifyMutation(mutationType.fields![0], concepts)).toBeNull();
    expect(classifyMutation(mutationType.fields![6], concepts)).toBeNull();
  });
});

describe('buildRootMutations', () => {
  it('keeps the first mutation of each kind and the rest in others', () => {
    const todo = buildRootMutations(mutationType, concepts).get('Todo')!;
    expect(todo.create?.field).toBe('createTodo');
    expect(todo.update?.field).toBe('updateTodo');
    expect(todo.delete?.field).toBe('deleteTodo');
    expect(todo.others.map((m) => m.field)).toEqual(['completeTodo', 'setTodoTitle']);
  });

  it('is empty for a source without mutations', () => {
    expect(buildRootMutations(null, concepts).size).toBe(0);
  });
});

describe('buildInputFields', () => {
  it('describes each field of an input object', () => {
    const fields = buildInputFields({
      kind: 'INPUT_OBJECT',
      name: 'UpdateTodoInput',
      inputFields: [
        { name: 'title', description: null, type: { kind: 'SCALAR', name: 'String' } },
        { name: 'completed', description: 'Done?', type: nonNull({ kind: 'SCALAR', name: 'Boolean' }) },
        { name: 'tags', description: null, type: { kind: 'LIST', name: null, ofType: { kind: 'SCALAR', name: 'String' } } },
      ],
    });
    expect(fields).toEqual([
      { name: 'title', description: null, type: 'String', typeName: 'String', typeKind: 'SCALAR', isList: false, required: false },
      { name: 'completed', description: 'Done?', type: 'Boolean!', typeName: 'Boolean', typeKind: 'SCALAR', isList: false, required: true },
      { name: 'tags', description: null, type: '[String]', typeName: 'String', typeKind: 'SCALAR', isList: true, required: false },
    ]);
  });

  it('is empty for anything but an input object', () => {
    expect(buildInputFields(null)).toEqual([]);
    expect(buildInputFields({ kind: 'OBJECT', name: 'Todo', inputFields: null })).toEqual([]);
  });
});

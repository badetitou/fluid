import { describe, it, expect } from 'vitest';
import { flattenIssues } from '../plugins/issues';
import { safeParseViewSpec } from '../view-spec';
import { parseActionRef } from './refs';
import { actionSpecSchema, checkViewActions } from './schema';
import { splitMutationName } from './kind';

const UPDATE = 'mutation($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id completed } }';
const DELETE = 'mutation($id: ID!) { deleteTodo(id: $id) }';

const problems = (action: unknown) => {
  const parsed = actionSpecSchema.safeParse(action);
  return parsed.success ? [] : flattenIssues(parsed.error.issues);
};

describe('actionSpecSchema', () => {
  it('accepts an update bound to the target and the form', () => {
    const action = { mutation: UPDATE, variables: { id: '$target.id', input: { completed: '$form.completed', note: '$$5' } } };
    expect(problems(action)).toEqual([]);
  });

  it('reports a document that is not a single mutation', () => {
    expect(problems({ mutation: '{ todos { id } }' })).toEqual(['mutation: Expected a mutation, found a query.']);
  });

  it('reports undeclared and missing variables', () => {
    expect(problems({ mutation: UPDATE, variables: { id: '$target.id', extra: 1 } })).toEqual([
      'variables.extra: $extra is not declared by the mutation.',
      'variables: The required variable $input has no value.',
    ]);
  });

  it('reports malformed references, nested ones included', () => {
    const [line] = problems({ mutation: UPDATE, variables: { id: '$row.id', input: {} } });
    expect(line).toMatch(/^variables\.id: "\$row\.id" is not a reference/);
    expect(problems({ mutation: UPDATE, variables: { id: '$target.id', input: { a: ['$form.'] } } })[0]).toMatch(
      /^variables\.input\.a\.0:/,
    );
  });

  it('requires a confirmation for a delete', () => {
    expect(problems({ mutation: DELETE, variables: { id: '$target.id' } })).toEqual([
      'confirm: deleteTodo deletes data: a confirm question is required.',
    ]);
    expect(problems({ mutation: DELETE, variables: { id: '$target.id' }, confirm: 'Delete this todo?' })).toEqual([]);
  });
});

describe('parseActionRef', () => {
  it('reads references, literals and escaped dollars', () => {
    expect(parseActionRef('$target')).toEqual({ ref: { source: 'target' } });
    expect(parseActionRef('$form.user.id')).toEqual({ ref: { source: 'form', path: 'user.id' } });
    expect(parseActionRef('$target.tags.0')).toEqual({ ref: { source: 'target', path: 'tags.0' } });
    expect(parseActionRef('hello')).toEqual({ literal: 'hello' });
    expect(parseActionRef('$$5')).toEqual({ literal: '$5' });
    expect(parseActionRef('$item')).toHaveProperty('error');
  });
});

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

describe('view spec actions', () => {
  const view = {
    id: 'v',
    concept: 'Todo',
    title: 'Todos',
    queries: { todos: { query: '{ todos { data { id } } }' } },
    widgets: [],
  };

  it('stays optional, and is kept when present', () => {
    expect(safeParseViewSpec(view).success).toBe(true);
    const parsed = safeParseViewSpec({ ...view, actions: { done: { mutation: UPDATE, variables: { id: '$target.id', input: '$form' } } } });
    expect(parsed.success && parsed.data.actions?.done.variables).toEqual({ id: '$target.id', input: '$form' });
  });

  it('rejects an invalid action', () => {
    expect(safeParseViewSpec({ ...view, actions: { done: { mutation: 'query { a }' } } }).success).toBe(false);
  });

  it('cross-checks the queries to refetch', () => {
    const actions = { done: { mutation: 'mutation { reset }', refetch: ['todos', 'users'] } };
    expect(checkViewActions({ ...view, actions })).toEqual(['actions.done.refetch: "users" is not a query of the view.']);
    expect(checkViewActions(view)).toEqual([]);
  });
});

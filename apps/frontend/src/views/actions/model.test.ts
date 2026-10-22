import { describe, it, expect } from 'vitest';
import { deletingFields, patchResults, resolveActionVariables } from './model';

const todo = (id: string, completed: boolean) => ({ __typename: 'Todo', id, title: `T${id}`, completed, user: { __typename: 'User', id: '1', name: 'Ann' } });

const results = {
  todos: { todos: { data: [todo('1', false), todo('2', false)] } },
  user: { user: { __typename: 'User', id: '1', name: 'Ann', todos: { data: [todo('2', false)] } } },
};

describe('resolveActionVariables', () => {
  it('replaces references at any depth and keeps literals', () => {
    const vars = resolveActionVariables(
      { id: '$target.id', input: { completed: '$form.completed', tags: ['$target.user.name', 'x'] }, note: '$$5', n: 3 },
      { target: todo('2', false), form: { completed: true } },
    );
    expect(vars).toEqual({ id: '2', input: { completed: true, tags: ['Ann', 'x'] }, note: '$5', n: 3 });
  });

  it('passes the whole form', () => {
    expect(resolveActionVariables({ input: '$form' }, { form: { title: 'New' } })).toEqual({ input: { title: 'New' } });
  });

  it('leaves missing values undefined', () => {
    expect(resolveActionVariables({ id: '$target.id' }, {})).toEqual({ id: undefined });
    expect(resolveActionVariables(undefined, {})).toEqual({});
  });
});

describe('deletingFields', () => {
  it('lists the deleting root fields', () => {
    expect(deletingFields({ mutation: 'mutation($id: ID!) { deleteTodo(id: $id) }' })).toEqual(['deleteTodo']);
    expect(deletingFields({ mutation: 'mutation { updateTodo(id: 1) { id } }' })).toEqual([]);
  });
});

describe('patchResults', () => {
  it('merges the returned item into every copy of it', () => {
    const next = patchResults(results, { updateTodo: { __typename: 'Todo', id: '2', completed: true, user: { id: '1' } } });
    const list = (next.todos as typeof results.todos).todos.data;
    expect(list[1]).toEqual({ ...todo('2', true), user: { __typename: 'User', id: '1', name: 'Ann' } });
    expect(list[0]).toEqual(todo('1', false));
    expect((next.user as typeof results.user).user.todos.data[0].completed).toBe(true);
  });

  it('does not merge an item of another type sharing the key', () => {
    const next = patchResults(results, { updateUser: { __typename: 'User', id: '2', name: 'Bob' } });
    expect((next.todos as typeof results.todos).todos.data[1]).toEqual(todo('2', false));
  });

  it('removes a deleted target from the lists holding it', () => {
    const next = patchResults(results, { deleteTodo: true }, todo('1', false));
    expect((next.todos as typeof results.todos).todos.data.map((t) => t.id)).toEqual(['2']);
    expect(next.user).toEqual(results.user);
  });

  it('returns the results untouched when nothing keyed came back', () => {
    expect(patchResults(results, { reset: true })).toBe(results);
    expect(patchResults(results, null)).toBe(results);
  });
});

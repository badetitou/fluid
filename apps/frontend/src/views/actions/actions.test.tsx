import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { Provider, type Client } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import { ViewRenderer } from '../ViewRenderer';
import { builtinWidgetCatalog } from '../widgets/catalog';
import { WidgetCatalogContext } from '../plugin-api/catalogContext';
import { WriteAccessContext } from '../plugin-api/actionsContext';
import { asRows } from '../data';
import type { WidgetCatalog, WidgetProps } from '../plugin-api/types';

type Todo = { __typename: 'Todo'; id: string; title: string; completed: boolean };
const todos: Todo[] = [
  { __typename: 'Todo', id: '1', title: 'Shop', completed: false },
  { __typename: 'Todo', id: '2', title: 'Cook', completed: false },
];

/** A test widget: one row per todo, a "done" and a "drop" button each, or a read-only marker. */
function TodoList({ data, invoke }: WidgetProps) {
  if (!invoke) return <p>read-only</p>;
  return (
    <ul>
      {asRows(data).map((t) => (
        <li key={String(t.id)}>
          {`${t.title}: ${t.completed ? 'done' : 'open'}`}
          <button onClick={() => invoke('done', { target: t, form: { completed: true } })}>{`done ${t.title}`}</button>
          <button onClick={() => invoke('drop', { target: t })}>{`drop ${t.title}`}</button>
        </li>
      ))}
    </ul>
  );
}

const builtin = builtinWidgetCatalog();
const catalog: WidgetCatalog = {
  ...builtin,
  renderers: new Map([...builtin.renderers, ['test/todos', { type: 'test/todos', Render: TodoList }]]),
};

const spec: ViewSpec = {
  version: 1,
  id: 'v',
  concept: 'Todo',
  title: 'Todos',
  queries: { todos: { query: '{ todos { data { id title completed } } }' } },
  actions: {
    done: {
      mutation: 'mutation($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id completed } }',
      variables: { id: '$target.id', input: '$form' },
    },
    drop: { mutation: 'mutation($id: ID!) { deleteTodo(id: $id) }', variables: { id: '$target.id' }, confirm: 'Drop it?' },
  },
  widgets: [{ id: 'list', type: 'test/todos', data: { query: 'todos', path: 'todos.data' } }],
};

const mutation = vi.fn((doc: string, vars: { id: string }) => ({
  toPromise: () =>
    Promise.resolve({
      data: doc.includes('deleteTodo')
        ? { deleteTodo: true }
        : { updateTodo: { __typename: 'Todo', id: vars.id, completed: true } },
    }),
}));
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { todos: { data: todos } } }) }),
  mutation,
} as unknown as Client;

const renderView = (writable: boolean) =>
  render(
    <AntdApp>
      <Provider value={client}>
        <WidgetCatalogContext.Provider value={catalog}>
          <WriteAccessContext.Provider value={writable}>
            <ViewRenderer spec={spec} />
          </WriteAccessContext.Provider>
        </WidgetCatalogContext.Provider>
      </Provider>
    </AntdApp>,
  );

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  mutation.mockClear();
});

describe('view actions', () => {
  it('leaves widgets read-only unless the source accepts writes', async () => {
    renderView(false);
    expect(await screen.findByText('read-only')).toBeTruthy();
  });

  it('sends the mutation with resolved variables and patches the view', async () => {
    renderView(true);
    fireEvent.click(await screen.findByText('done Cook'));
    expect(await screen.findByText('Cook: done')).toBeTruthy();
    expect(screen.getByText('Shop: open')).toBeTruthy();
    expect(mutation).toHaveBeenCalledWith(spec.actions!.done.mutation, { id: '2', input: { completed: true } });
  });

  it('asks before deleting, then removes the target', async () => {
    renderView(true);
    fireEvent.click(await screen.findByText('drop Shop'));
    expect((await screen.findByRole('dialog')).textContent).toContain('Drop it?');
    expect(mutation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByText('Shop: open')).toBeNull());
    expect(screen.getByText('Cook: open')).toBeTruthy();
  });
});

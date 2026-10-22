import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { Client, fetchExchange, Provider } from 'urql';
import { todoEditExample, todoListExample, type ViewSpec } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { WriteAccessContext } from '../../plugin-api/actionsContext';

// A fake GraphQL source behind `fetch`, as urql's fetch exchange calls it:
// todos, the UpdateTodoInput type, and every mutation recorded.
const todos = [
  {
    __typename: 'Todo',
    id: '1',
    title: 'Shop',
    completed: false,
    user: { __typename: 'User', id: '9', name: 'Ann' },
  },
  {
    __typename: 'Todo',
    id: '2',
    title: 'Cook',
    completed: false,
    user: { __typename: 'User', id: '9', name: 'Ann' },
  },
];
const updateTodoInput = {
  kind: 'INPUT_OBJECT',
  name: 'UpdateTodoInput',
  inputFields: [
    { name: 'title', description: null, type: { kind: 'SCALAR', name: 'String', ofType: null } },
    {
      name: 'completed',
      description: null,
      type: { kind: 'SCALAR', name: 'Boolean', ofType: null },
    },
  ],
};
const mutations: { query: string; variables: Record<string, unknown> }[] = [];

function answer(query: string, variables: Record<string, unknown>): unknown {
  if (query.includes('__type')) return { __type: updateTodoInput };
  if (query.startsWith('mutation')) {
    mutations.push({ query, variables });
    if (query.includes('deleteTodo')) return { deleteTodo: true };
    const input = variables.input as Record<string, unknown> | undefined;
    return { updateTodo: { ...todos.find((t) => t.id === variables.id), ...input } };
  }
  if (query.includes('todos(')) return { todos: { __typename: 'TodosPage', data: todos } };
  return { todo: todos[0] };
}

const fakeFetch = vi.fn(async (_url: string, init: RequestInit) => {
  const { query, variables } = JSON.parse(String(init.body)) as {
    query: string;
    variables?: Record<string, unknown>;
  };
  return new Response(JSON.stringify({ data: answer(query.trim(), variables ?? {}) }), {
    headers: { 'content-type': 'application/json' },
  });
});

const renderView = (spec: ViewSpec, writable: boolean) => {
  const client = new Client({
    url: 'http://source.test/graphql',
    exchanges: [fetchExchange],
    fetch: fakeFetch as typeof fetch,
    preferGetMethod: false,
  });
  return render(
    <MemoryRouter>
      <AntdApp>
        <Provider value={client}>
          <WriteAccessContext.Provider value={writable}>
            <ViewRenderer spec={spec} />
          </WriteAccessContext.Provider>
        </Provider>
      </AntdApp>
    </MemoryRouter>,
  );
};

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
  mutations.length = 0;
});

describe('form widget', () => {
  it('stays read-only, saying why, while the source does not accept writes', async () => {
    renderView(todoEditExample, false);
    expect(await screen.findByText(/Read-only: allow changes/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits the edited values with the bound object as target, and shows the result', async () => {
    renderView(todoEditExample, true);
    const title = await screen.findByLabelText('Title');
    expect((title as HTMLInputElement).value).toBe('Shop');
    fireEvent.change(title, { target: { value: 'Shop more' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0].variables).toEqual({
      id: '1',
      input: { title: 'Shop more', completed: false },
    });
    expect(await screen.findByText('Shop more')).toBeTruthy();
  });

  it('infers its fields from the input type when none is configured', async () => {
    const edit = todoEditExample.widgets[1];
    const spec = { ...todoEditExample, widgets: [{ ...edit, fields: undefined }] } as ViewSpec;
    renderView(spec, true);
    expect(await screen.findByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Completed')).toBeTruthy();
  });
});

describe('table row actions', () => {
  it('are hidden while the source does not accept writes', async () => {
    renderView(todoListExample, false);
    expect(await screen.findByText('Cook')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('run their action on the row, after confirming a deletion', async () => {
    renderView(todoListExample, true);
    const row = (await screen.findByText('Cook')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    );
    await waitFor(() => expect(screen.queryByText('Cook')).toBeNull());
    expect(mutations[0].variables).toEqual({ id: '2' });
  });
});

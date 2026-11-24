import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { McpViewer } from './McpViewer';
import { installFakeHost } from './testHost';

const host = installFakeHost();

const DELETE = 'mutation($id: ID!) { deleteTodo(id: $id) }';
const SPEC = {
  version: 1,
  id: 'v1',
  concept: 'Todo',
  title: 'Todos',
  queries: { list: { query: 'query($take: Int){ todos(take: $take){ id title } }' } },
  actions: { remove: { mutation: DELETE, variables: { id: '$target.id' }, confirm: 'Delete this todo?' } },
  widgets: [
    { id: 't', type: 'table', data: { query: 'list', path: 'todos' }, columns: [{ key: 'title' }], rowActions: [{ action: 'remove', label: 'Delete', danger: true }] },
  ],
};
const result = (structuredContent: object) => ({ content: [{ type: 'text', text: 'ok' }], structuredContent });
const shown = (writable: boolean) =>
  result({ viewId: 'v1', sourceId: 's1', take: 100, writable, spec: SPEC, data: { list: { data: { todos: [{ id: '1', title: 'Buy milk' }, { id: '2', title: 'Walk' }] } } } });
const calls = (method: string) => host.sent.filter((m) => m.method === method);

async function showTodos(writable: boolean) {
  // Same wrapper as the viewer's entry point: antd's contextual modal is owned by the React tree.
  render(
    <AntdApp>
      <McpViewer />
    </AntdApp>,
  );
  await host.handshake();
  host.fromHost({ method: 'ui/notifications/tool-result', params: shown(writable) });
  await screen.findByText('Buy milk');
}

describe('McpViewer actions', () => {
  it('confirms a deletion, saying so, then runs it through invoke_action', async () => {
    await showTodos(true);
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect((await screen.findAllByText(/deletes data in the source \(deleteTodo\)\. This cannot be undone\./)).length).toBeGreaterThan(0);
    expect(calls('tools/call')).toHaveLength(0);
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(calls('tools/call')).toHaveLength(1));
    expect(calls('tools/call')[0].params).toEqual({ name: 'invoke_action', arguments: { viewId: 'v1', sourceId: 's1', action: 'remove', variables: { id: '1' } } });
    host.answerTool('invoke_action', result({ data: { deleteTodo: true } }));
    await waitFor(() => expect(screen.queryByText('Buy milk')).toBeNull());
  });

  it('sends nothing when the user cancels', async () => {
    await showTodos(true);
    fireEvent.click(screen.getAllByText('Delete')[0]);
    await screen.findAllByText(/cannot be undone/);
    fireEvent.click(screen.getAllByText('Cancel').at(-1)!);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls('tools/call')).toHaveLength(0);
    expect(screen.getByText('Buy milk')).toBeTruthy();
  });

  it('shows the view read-only when the source does not allow changes', async () => {
    await showTodos(false);
    expect(screen.queryByText('Delete')).toBeNull();
  });
});

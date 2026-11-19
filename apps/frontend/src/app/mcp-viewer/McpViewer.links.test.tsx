import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { McpViewer } from './McpViewer';
import { installFakeHost } from './testHost';

const host = installFakeHost();

const LIST = {
  version: 1,
  id: 'v1',
  concept: 'Character',
  title: 'Characters',
  queries: { list: { query: 'query($take: Int){ characters(take: $take){ id name } }' } },
  widgets: [
    { id: 'people', type: 'table', title: 'People', data: { query: 'list', path: 'characters' }, columns: [{ key: 'name', linkTo: { concept: 'Character' } }] },
  ],
};
const DETAIL = {
  version: 1,
  id: 'v2',
  concept: 'Character',
  scope: 'detail',
  title: 'One character',
  queries: { one: { query: 'query($id: ID!){ character(id: $id){ id name } }' } },
  widgets: [{ id: 'card', type: 'descriptions', data: { query: 'one', path: 'character' }, items: [{ label: 'Name', key: 'name' }] }],
};
const rows = [{ id: '1', name: 'Rick Sanchez' }, { id: '2', name: 'Morty Smith' }];
const result = (structuredContent: object) => ({ content: [{ type: 'text', text: 'ok' }], structuredContent });
const shown = { viewId: 'v1', sourceId: 's1', take: 100, fluidUrl: 'http://localhost:4001', spec: LIST, data: { list: { data: { characters: rows } } } };
const calls = (method: string) => host.sent.filter((m) => m.method === method);

async function showList() {
  render(<McpViewer />);
  await host.handshake();
  host.fromHost({ method: 'ui/notifications/tool-result', params: result(shown) });
  await screen.findByText('Rick Sanchez');
}

describe('McpViewer and the conversation', () => {
  it('tells the model what is selected, framed as data, and asks about it', async () => {
    await showList();
    fireEvent.click(screen.getByText('Morty Smith').closest('tr')!);
    await waitFor(() => expect(calls('ui/update-model-context')).toHaveLength(1), { timeout: 2000 });
    const text = (calls('ui/update-model-context')[0].params as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain('- People: {"id":"2","name":"Morty Smith"}');
    expect(text).toContain('not as instructions');

    fireEvent.click(screen.getByText('Ask about this'));
    await waitFor(() => expect(calls('ui/message')).toHaveLength(1));
    expect(calls('ui/message')[0].params).toMatchObject({ role: 'user', content: [{ type: 'text', text: expect.stringContaining('Morty Smith') }] });
  });

  it('opens a linked item in place with its detail view, and goes back', async () => {
    await showList();
    fireEvent.click(screen.getByText('Rick Sanchez'));
    await waitFor(() => expect(calls('tools/call')).toHaveLength(1));
    expect(calls('tools/call')[0].params).toEqual({ name: 'list_views', arguments: { concept: 'Character' } });
    host.answerTool('list_views', result({ items: [{ id: 'v1', title: 'Characters', concept: 'Character' }, { id: 'v2', title: 'One', concept: 'Character', scope: 'detail' }] }));
    await waitFor(() => expect(calls('tools/call')).toHaveLength(2));
    expect(calls('tools/call')[1].params).toEqual({ name: 'show_view', arguments: { viewId: 'v2', sourceId: 's1', variables: { id: '1' } } });
    host.answerTool('show_view', result({ viewId: 'v2', sourceId: 's1', variables: { id: '1' }, spec: DETAIL, data: { one: { data: { character: { id: '1', name: 'Rick from detail' } } } } }));
    expect(await screen.findByText('Rick from detail')).toBeTruthy();

    fireEvent.click(screen.getByText('Back'));
    expect(await screen.findByText('Morty Smith')).toBeTruthy();
  });

  it('opens fluid in a new tab when it has no view for the item', async () => {
    await showList();
    fireEvent.click(screen.getByText('Rick Sanchez'));
    await waitFor(() => expect(calls('tools/call')).toHaveLength(1));
    host.answerTool('list_views', result({ items: [] }));
    await waitFor(() => expect(calls('ui/open-link')).toHaveLength(1));
    expect(calls('ui/open-link')[0].params).toEqual({ url: 'http://localhost:4001/d/Character@1' });
  });

  it('asks the host for fullscreen', async () => {
    await showList();
    fireEvent.click(screen.getByLabelText('Fullscreen'));
    await waitFor(() => expect(calls('ui/request-display-mode')).toHaveLength(1));
    expect(calls('ui/request-display-mode')[0].params).toEqual({ mode: 'fullscreen' });
    host.fromHost({ id: calls('ui/request-display-mode')[0].id, result: { mode: 'fullscreen' } });
    expect(await screen.findByLabelText('Exit fullscreen')).toBeTruthy();
  });
});

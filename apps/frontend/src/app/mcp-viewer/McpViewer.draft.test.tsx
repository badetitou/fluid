import { describe, expect, it } from 'vitest';
import { fireEvent, render as renderViewer, screen, waitFor } from '@testing-library/react';
import { SPEC } from './fixtures';
import { McpViewer } from './McpViewer';
import { installFakeHost } from './testHost';

const host = installFakeHost();
const { version: _v, id: _id, concept: _c, ...VIEW } = SPEC;
const draftResult = (issues: string[] = []) => ({
  method: 'ui/notifications/tool-result',
  params: {
    content: [{ type: 'text', text: 'ok' }],
    structuredContent: {
      draft: true,
      sourceId: 's1',
      concept: 'Character',
      request: 'who is there?',
      take: 100,
      spec: { ...SPEC, id: 'draft-1', intent: 'who is there?' },
      data: { list: { data: { characters: [{ id: '1', name: 'Rick Sanchez' }] } } },
      issues,
    },
  },
});

describe('McpViewer with a drafted view', () => {
  it('previews the draft while the arguments stream, then renders the result', async () => {
    render();
    await host.handshake();
    host.fromHost({
      method: 'ui/notifications/tool-input-partial',
      params: { arguments: { sourceId: 's1', view: { title: 'Who is there', widgets: [{ id: 'w1', type: 'table', title: 'All characters' }] } } },
    });
    expect(await screen.findByText('Who is there')).toBeTruthy();
    expect(screen.getByText('All characters')).toBeTruthy();
    host.fromHost(draftResult());
    expect(await screen.findByText('Rick Sanchez')).toBeTruthy();
    expect(screen.queryByText('Who is there')).toBeNull();
  });

  it('saves the draft with the request, then says it is saved', async () => {
    render();
    await host.handshake();
    host.fromHost(draftResult(['queries.list: something']));
    expect(await screen.findByText('queries.list: something')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save in fluid' }));
    await waitFor(() => expect(host.sent.some((m) => m.method === 'tools/call')).toBe(true));
    const call = host.sent.find((m) => m.method === 'tools/call');
    expect(call?.params).toEqual({ name: 'save_view', arguments: { sourceId: 's1', concept: 'Character', request: 'who is there?', view: VIEW } });
    host.answerTool('save_view', { content: [{ type: 'text', text: 'Saved' }], structuredContent: { viewId: 'v9', title: 'Characters' } });
    expect(await screen.findByText('Saved in fluid as "Characters".')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save in fluid' })).toBeNull();
  });

  it('shows why a save failed and keeps the button', async () => {
    render();
    await host.handshake();
    host.fromHost(draftResult());
    fireEvent.click(await screen.findByRole('button', { name: 'Save in fluid' }));
    await waitFor(() => expect(host.sent.some((m) => m.method === 'tools/call')).toBe(true));
    host.answerTool('save_view', { isError: true, content: [{ type: 'text', text: 'fluid refused it' }] });
    expect(await screen.findByText('fluid refused it')).toBeTruthy();
    expect(await screen.findByText('Save in fluid')).toBeTruthy();
  });
});

function render() {
  return renderViewer(<McpViewer />);
}

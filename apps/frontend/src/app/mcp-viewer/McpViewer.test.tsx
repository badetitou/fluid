import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { SPEC } from './fixtures';
import { McpViewer } from './McpViewer';

let sent: Record<string, unknown>[] = [];
// In jsdom the page is its own parent: give it a distinct host frame, so the source check means something.
const host = { postMessage: (m: Record<string, unknown>) => void sent.push(m) };
const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

/** What the host does: write to the viewer window as if the message came from the parent frame. */
function fromHost(message: object, source: unknown = host) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { jsonrpc: '2.0', ...message }, source: source as Window }));
  });
}

beforeEach(() => {
  sent = [];
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as never;
  Object.defineProperty(window, 'parent', { value: host, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 300 } as DOMRect);
});
afterEach(() => {
  cleanup();
  if (realParent) Object.defineProperty(window, 'parent', realParent);
  vi.restoreAllMocks();
});

const toolResult = {
  method: 'ui/notifications/tool-result',
  params: {
    content: [{ type: 'text', text: 'ok' }],
    structuredContent: {
      viewId: 'v1',
      sourceId: 's1',
      take: 100,
      spec: SPEC,
      data: { list: { data: { characters: [{ id: '1', name: 'Rick Sanchez' }, { id: '2', name: 'Morty Smith' }] } } },
    },
  },
};

describe('McpViewer', () => {
  it('does the handshake, then renders the table of the tool result without any network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<McpViewer />);
    const init = sent.find((m) => m.method === 'ui/initialize');
    expect(init).toBeDefined();
    fromHost({ id: init!.id, result: { hostContext: { theme: 'dark' } } });
    await waitFor(() => expect(sent.some((m) => m.method === 'ui/notifications/initialized')).toBe(true));
    expect(document.documentElement.dataset.theme).toBe('dark');

    fromHost(toolResult);
    expect(await screen.findByText('Rick Sanchez')).toBeTruthy();
    expect(screen.getByText('Morty Smith')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sent.some((m) => m.method === 'ui/notifications/size-changed')).toBe(true);
  });

  it('ignores a tool result that does not come from the host frame', async () => {
    render(<McpViewer />);
    fromHost(toolResult, window);
    await act(async () => {});
    expect(screen.queryByText('Rick Sanchez')).toBeNull();
    expect(screen.getByText('Waiting for the view…')).toBeTruthy();
  });

  it('follows a host-context-changed between dark and light', async () => {
    render(<McpViewer />);
    fromHost({ method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    fromHost({ method: 'ui/notifications/host-context-changed', params: { theme: 'light' } });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('shows the error text of a failed tool', async () => {
    render(<McpViewer />);
    fromHost({ method: 'ui/notifications/tool-result', params: { isError: true, content: [{ type: 'text', text: 'Sign in to Rick first' }] } });
    expect(await screen.findByText('Sign in to Rick first')).toBeTruthy();
  });

  it('posts nothing but the handshake request before it is connected', async () => {
    render(<McpViewer />);
    await act(async () => {});
    expect(sent.map((m) => m.method)).toEqual(['ui/initialize']);
    const init = sent[0];
    fromHost({ id: init.id, result: {} });
    await waitFor(() => expect(sent.some((m) => m.method === 'ui/notifications/size-changed')).toBe(true));
    const order = sent.map((m) => m.method);
    expect(order.indexOf('ui/notifications/initialized')).toBeLessThan(order.indexOf('ui/notifications/size-changed'));
  });

  it('keeps the last good view when a later tool result fails', async () => {
    render(<McpViewer />);
    fromHost(toolResult);
    expect(await screen.findByText('Rick Sanchez')).toBeTruthy();
    fromHost({ method: 'ui/notifications/tool-result', params: { isError: true, content: [{ type: 'text', text: 'Source down' }] } });
    expect(await screen.findByText('Source down')).toBeTruthy();
    expect(screen.getByText('Rick Sanchez')).toBeTruthy();
  });

  it('shows an error when the host does not answer the handshake', async () => {
    vi.useFakeTimers();
    render(<McpViewer />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(/Could not reach the host/)).toBeTruthy();
    vi.useRealTimers();
  });
});

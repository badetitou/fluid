import { afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';

// A fake host frame for the viewer's component tests.

export interface FakeHost {
  /** Everything the viewer posted to the host. */
  sent: Record<string, unknown>[];
  /** Writes to the viewer window as if the message came from the parent frame. */
  fromHost: (message: object) => void;
  /** Answers `ui/initialize` and waits for `ui/notifications/initialized`. */
  handshake: () => Promise<void>;
  /** Answers the last `tools/call` of this tool. */
  answerTool: (name: string, result: object) => void;
}

/** Registers the jsdom setup (a distinct parent frame, observers, matchMedia) for the current test file. */
export function installFakeHost(): FakeHost {
  const fake: FakeHost = {
    sent: [],
    fromHost: (message) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: { jsonrpc: '2.0', ...message }, source: host as unknown as Window }));
      }),
    handshake: async () => {
      const init = fake.sent.find((m) => m.method === 'ui/initialize');
      fake.fromHost({ id: init?.id, result: {} });
      await waitFor(() => {
        if (!fake.sent.some((m) => m.method === 'ui/notifications/initialized')) throw new Error('not initialized');
      });
    },
    answerTool: (name, result) => {
      const call = [...fake.sent].reverse().find((m) => m.method === 'tools/call' && (m.params as { name?: string }).name === name);
      fake.fromHost({ id: call?.id, result });
    },
  };
  const host = { postMessage: (m: Record<string, unknown>) => void fake.sent.push(m) };
  const realParent = Object.getOwnPropertyDescriptor(window, 'parent');

  beforeEach(() => {
    fake.sent.length = 0;
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
  return fake;
}

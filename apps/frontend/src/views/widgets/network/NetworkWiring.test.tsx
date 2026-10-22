import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { characterEpisodesNetworkExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';

// End to end: the curated view, its network emitting the clicked node on
// `selected`, read by the descriptions widget bound to `@appearances`.
const sigmas = vi.hoisted(() => [] as { fire: (event: string, payload?: unknown) => void }[]);
vi.mock('sigma', () => {
  class Sigma {
    handlers = new Map<string, (payload: unknown) => void>();
    constructor(public graph: unknown) {
      sigmas.push(this);
    }
    on(event: string, handler: (payload: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload);
    }
    setSettings() {
      return this;
    }
    getGraph() {
      return this.graph;
    }
    setGraph(graph: unknown) {
      this.graph = graph;
    }
    resize() {
      return this;
    }
    refresh() {
      return this;
    }
    kill() {}
  }
  return { default: Sigma, Sigma };
});
vi.mock('graphology-layout-forceatlas2/worker', () => ({
  default: class {
    start() {}
    stop() {}
    kill() {}
  },
}));

const characters = {
  results: [
    {
      __typename: 'Character',
      id: '1',
      name: 'Rick Sanchez',
      species: 'Human',
      status: 'Alive',
      episode: [{ __typename: 'Episode', id: '1', name: 'Pilot', code: 'S01E01', air_date: 'December 2, 2013' }],
    },
  ],
};
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { characters } }) }),
} as unknown as Client;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 400 }) as DOMRect;
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
afterEach(cleanup);

describe('network wiring', () => {
  it('feeds the clicked node to the widget bound to `@appearances`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={characterEpisodesNetworkExample} />
        </Provider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(sigmas.length).toBeGreaterThan(0));
    expect(screen.queryByText('S01E01')).toBeNull();
    act(() => sigmas[sigmas.length - 1].fire('clickNode', { node: 'Pilot' }));
    expect(await screen.findByText('S01E01')).toBeTruthy();
    expect(screen.getByText('December 2, 2013')).toBeTruthy();
  });
});

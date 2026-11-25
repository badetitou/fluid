import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import type { GraphExplorerWidget, ViewSpec } from '@fluid/shared';
import { GraphSessionProvider } from '../../graphSession';
import { ViewRenderer } from '../../ViewRenderer';

// jsdom has no WebGL: record the sigma graph and fire its events instead.
const sigmas = vi.hoisted(() => [] as {
  graph: { order: number; size: number };
  camera: Record<string, number>;
  fire: (event: string, payload?: unknown) => void;
}[]);
vi.mock('sigma', () => {
  class Sigma {
    handlers = new Map<string, (payload: unknown) => void>();
    camera: Record<string, number> = { x: 0.5, y: 0.5, ratio: 1 };
    constructor(public graph: { order: number; size: number }, _container: HTMLElement, _settings: unknown) {
      sigmas.push(this as never);
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
    setGraph(graph: { order: number; size: number }) {
      this.graph = graph;
    }
    getCamera() {
      return {
        getState: () => ({ ...this.camera }),
        setState: (state: Partial<Record<string, number>>) => Object.assign(this.camera, state),
      };
    }
    getBBox() {
      const extent = { x: [Infinity, -Infinity], y: [Infinity, -Infinity] } as { x: [number, number]; y: [number, number] };
      const graph = this.graph as unknown as { forEachNode(fn: (key: string, attrs: { x: number; y: number }) => void): void };
      graph.forEachNode((_key, attrs) => {
        extent.x[0] = Math.min(extent.x[0], attrs.x);
        extent.x[1] = Math.max(extent.x[1], attrs.x);
        extent.y[0] = Math.min(extent.y[0], attrs.y);
        extent.y[1] = Math.max(extent.y[1], attrs.y);
      });
      return extent;
    }
    getGraphToViewportRatio() {
      return 1;
    }
    graphToViewport(point: { x: number; y: number }) {
      return point;
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

const nodes = [
  { id: '1', name: 'A', kind: 'class', parent: { id: '10', name: 'PkgA' } },
  { id: '2', name: 'B', kind: 'class', parent: { id: '10', name: 'PkgA' } },
  { id: '10', name: 'PkgA', kind: 'package', parent: null },
];
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { classes: { nodes } } }) }),
} as unknown as Client;

const widget: GraphExplorerWidget = {
  id: 'explorer',
  data: { path: 'classes.nodes', query: 'classes' },
  span: 24,
  type: 'graphExplorer',
  title: 'Explorateur de classes',
  height: 560,
  preset: 'generic',
  widgets: [
    {
      id: 'node-details',
      data: { query: '$node' },
      type: 'descriptions',
      items: [
        { key: 'name', label: 'Nom' },
        { key: 'kind', label: 'Kind', format: 'tag' },
      ],
      title: 'Classe',
      columns: 2,
    },
  ],
  overview: 'network',
  groupField: 'kind',
  linksField: 'parent',
  groupByField: 'parent.name',
  collapseAbove: 30,
};

const spec: ViewSpec = {
  version: 1,
  id: 'user-spec',
  concept: 'Class',
  title: 'Explorateur de classes',
  queries: {
    classes: {
      query: 'query($take: Int) { classes(first: $take) { nodes { id name kind parent { id name } } } }',
      variables: { take: 500 },
    },
  },
  widgets: [widget],
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 1000, height: 600 }) as DOMRect;
  HTMLCanvasElement.prototype.getContext = () =>
    ({
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      setTransform: () => {},
    }) as unknown as CanvasRenderingContext2D;
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
  sigmas.length = 0;
});

describe('graph explorer clipboard spec', () => {
  it('renders the hierarchy and expands nested descriptions without changing the view spec', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <GraphSessionProvider>
            <ViewRenderer spec={spec} />
          </GraphSessionProvider>
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(sigmas).toHaveLength(1));
    expect(sigmas[0].graph.order).toBeGreaterThan(3); // root box + fold boxes + leaves
    expect(sigmas[0].camera.x).toBeGreaterThanOrEqual(0);
    expect(sigmas[0].camera.x).toBeLessThanOrEqual(1);
    const buttons = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(buttons).toEqual(expect.arrayContaining(['Present widget', 'Focus selection', 'Collapse all', 'Expand all']));

    act(() => sigmas[0].fire('enterNode', { node: '1', event: { x: 200, y: 120 } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Expand A' }));
    expect(await screen.findByText('Nom')).toBeTruthy();

    // Expansion and camera state are session-only.
    expect(widget).not.toHaveProperty('expanded');
    expect(widget).not.toHaveProperty('initialExpanded');
    expect(spec).not.toHaveProperty('session');
  });
});

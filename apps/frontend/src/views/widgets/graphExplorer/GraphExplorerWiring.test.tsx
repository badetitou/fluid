import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { GRAPH_DETAIL_QUERY, GRAPH_NODE_QUERY, type ViewSpec } from '@fluid/shared';
import { GraphSessionProvider } from '../../graphSession';
import { ViewRenderer } from '../../ViewRenderer';

// WebGL does not exist in jsdom: sigma is replaced by a fake that records its
// graph and lets the test fire its events. No DOM node is created per graph node.
interface FakeSigma {
  graph: { order: number; size: number };
  settings: Record<string, unknown>;
  camera: Record<string, number>;
  fire: (event: string, payload?: unknown) => void;
}
const sigmas = vi.hoisted(() => [] as FakeSigma[]);
vi.mock('sigma', () => {
  class Sigma {
    handlers = new Map<string, (payload: unknown) => void>();
    camera: Record<string, number> = { x: 0, y: 0, ratio: 1 };
    constructor(
      public graph: { order: number; size: number },
      _container: HTMLElement,
      public settings: Record<string, unknown>,
    ) {
      sigmas.push(this as unknown as FakeSigma);
    }
    on(event: string, handler: (payload: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload);
    }
    setSettings(settings: Record<string, unknown>) {
      Object.assign(this.settings, settings);
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

const classes = [
  { id: '1', name: 'Alpha', dependencies: [{ id: '2', name: 'Beta' }] },
  { id: '2', name: 'Beta', dependencies: [] },
];

const calls: string[] = [];
const client = {
  query: (query: string, variables: { nodeId?: string } = {}) => {
    calls.push(query);
    const data = query.includes('FluidExplorerDetail')
      ? { class: { id: variables.nodeId, name: 'Alpha', methods: [{ selector: 'ping' }] } }
      : { classes };
    return { toPromise: () => Promise.resolve({ data }) };
  },
} as unknown as Client;

const spec: ViewSpec = {
  version: 1,
  id: 'explorer-test',
  concept: 'Class',
  title: 'Explorer wiring',
  queries: {
    classes: { query: 'query FluidExplorerClasses { classes { id name dependencies { id name } } }' },
    detail: {
      query: 'query FluidExplorerDetail($nodeId: ID!) { class(id: $nodeId) { id name methods { selector } } }',
      lazy: true,
    },
  },
  widgets: [
    {
      id: 'explorer',
      type: 'graphExplorer',
      title: 'Dependencies',
      span: 24,
      data: { query: 'classes', path: 'classes' },
      linksField: 'dependencies',
      detailQuery: 'detail',
      detailPath: 'class',
      widgets: [
        {
          id: 'node-card',
          type: 'descriptions',
          data: { query: GRAPH_NODE_QUERY },
          columns: 1,
          items: [{ key: 'name', label: 'Name' }],
        },
        {
          id: 'methods',
          type: 'table',
          title: 'Methods',
          data: { query: GRAPH_DETAIL_QUERY, path: 'methods' },
          columns: [{ key: 'selector', title: 'Selector' }],
        },
      ],
    },
  ],
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
  calls.length = 0;
  sigmas.length = 0;
});

const hover = (key: string) => {
  const sigma = sigmas.at(-1);
  act(() => sigma?.fire('enterNode', { node: key, event: { x: 200, y: 120 } }));
};

describe('graph explorer wiring', () => {
  it('opens a node as a box in the WebGL graph and runs its lazy detail only then', async () => {
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
    expect(sigmas[0].graph.order).toBe(3); // root box + two leaves
    // Sigma's camera lives in normalized [0, 1] space, never in graph units.
    expect(sigmas[0].camera.x).toBeGreaterThanOrEqual(0);
    expect(sigmas[0].camera.x).toBeLessThanOrEqual(1);
    expect(calls.some((query) => query.includes('FluidExplorerDetail'))).toBe(false);

    hover('1');
    expect(await screen.findByRole('button', { name: 'Expand Alpha' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Alpha' }));

    const [collapse] = await screen.findAllByRole('button', { name: 'Collapse Alpha' });
    expect(collapse).toBeTruthy();
    expect(await screen.findByText('ping')).toBeTruthy();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(1);
    expect(calls.some((query) => query.includes('FluidExplorerDetail'))).toBe(true);

    fireEvent.click(collapse);
    await waitFor(() => expect(screen.queryByText('ping')).toBeNull());
    expect(spec.widgets[0]).not.toHaveProperty('initialExpanded');
  });
});

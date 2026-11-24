import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { GRAPH_DETAIL_QUERY, GRAPH_NODE_QUERY, type ViewSpec } from '@fluid/shared';
import { GraphSessionProvider } from '../../graphSession';
import { ViewRenderer } from '../../ViewRenderer';

// React Flow is mocked with the part the explorer relies on: it hands its nodes
// to the registered node components. The expansion is therefore checked where
// it matters — the drawn node list, not a floating overlay.
interface MockFlowNode {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  selected?: boolean;
  sourcePosition?: unknown;
  targetPosition?: unknown;
}
type MockNodeComponent = ComponentType<MockFlowNode>;
interface MockFlowProps {
  nodes: MockFlowNode[];
  nodeTypes: Record<string, MockNodeComponent>;
  onNodeClick?: (event: unknown, node: MockFlowNode) => void;
  onNodeDoubleClick?: (event: unknown, node: MockFlowNode) => void;
  children?: ReactNode;
}

const flow = vi.hoisted(() => {
  const state = { nodes: [] as MockFlowNode[] };
  (globalThis as unknown as { __graphExplorerFlow: typeof state }).__graphExplorerFlow = state;
  return state;
});
vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  const ReactFlow = ({ nodes, nodeTypes, onNodeClick, onNodeDoubleClick, children }: MockFlowProps) => {
    (globalThis as unknown as { __graphExplorerFlow: { nodes: MockFlowNode[] } }).__graphExplorerFlow.nodes = nodes;
    return React.createElement(
      'div',
      { 'data-testid': 'flow' },
      nodes.map((node) => {
        const Node = nodeTypes[node.type ?? 'graphNode'];
        return React.createElement(
          'div',
          {
            key: node.id,
            onClick: () => onNodeClick?.(undefined, node),
            onDoubleClick: () => onNodeDoubleClick?.(undefined, node),
          },
          React.createElement(Node, node),
        );
      }),
      children,
    );
  };
  return {
    ReactFlow,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    MarkerType: { ArrowClosed: 'arrowclosed' },
  };
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
      graphLayout: 'layered',
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
});

describe('graph explorer wiring', () => {
  it('opens a node as a box in the graph and runs its lazy detail only then', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <GraphSessionProvider>
            <ViewRenderer spec={spec} />
          </GraphSessionProvider>
        </Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Expand Alpha' })).toBeTruthy();
    await waitFor(() => expect(flow.nodes.some((node) => node.id === '1' && node.type === 'graphNode')).toBe(true));
    expect(calls.some((query) => query.includes('FluidExplorerDetail'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Expand Alpha' }));

    expect(await screen.findByRole('button', { name: 'Collapse Alpha' })).toBeTruthy();
    expect(await screen.findByText('ping')).toBeTruthy();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(1);
    expect(flow.nodes.find((node) => node.id === '1')?.type).toBe('expandedNode');
    expect(calls.some((query) => query.includes('FluidExplorerDetail'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Alpha' }));
    await waitFor(() => expect(flow.nodes.find((node) => node.id === '1')?.type).toBe('graphNode'));
    expect(screen.queryByText('ping')).toBeNull();
    expect(spec.widgets[0]).not.toHaveProperty('initialExpanded');
  });
});

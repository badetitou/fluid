import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider, type Client } from 'urql';
import { z } from 'zod';
import type { ViewSpec } from '@fluid/shared';
import { DataSourcesContext, type DataSource } from './plugin-api/dataSources';
import { RenderedViewContext } from './plugin-api/viewContext';
import { readNodeDetail, useNodeDetail, type NodeDetailOptions } from './useNodeDetail';

const spec: ViewSpec = {
  version: 1,
  id: 'v',
  concept: 'Node',
  title: 'Nodes',
  queries: {
    detail: { query: 'query($nodeId: ID!) { node(id: $nodeId) { id label } }', variables: { static: 'x' } },
    remote: { query: 'details', source: 'pharo' },
  },
  widgets: [],
};

function wrap(client: Client, sources: ReadonlyMap<string, DataSource> = new Map(), view: ViewSpec = spec) {
  return ({ children }: { children: ReactNode }) => (
    <Provider value={client}>
      <DataSourcesContext.Provider value={sources}>
        <RenderedViewContext.Provider value={view}>{children}</RenderedViewContext.Provider>
      </DataSourcesContext.Provider>
    </Provider>
  );
}

function clientReturning(data: unknown) {
  const query = vi.fn((_text: string, _variables: Record<string, unknown>) => ({
    toPromise: () => Promise.resolve({ data }),
  }));
  return { client: { query } as unknown as Client, query };
}

function deferredClient() {
  const pending: Array<(answer: { data?: unknown }) => void> = [];
  const client = {
    query: () => ({ toPromise: () => new Promise<{ data?: unknown }>((resolve) => pending.push(resolve)) }),
  } as unknown as Client;
  return { client, pending };
}

describe('readNodeDetail', () => {
  it('selects a cached answer and reports a miss', () => {
    const cache = new Map<string, unknown>([['k|n', { node: { id: 'n' } }]]);
    expect(readNodeDetail(cache, 'k|n', 'node')).toEqual({ data: { id: 'n' }, loading: false });
    expect(readNodeDetail(cache, 'k|other', 'node')).toBeUndefined();
  });

  it('validates a cached answer with a schema', () => {
    const cache = new Map<string, unknown>([['k|n', { node: { id: 'n', label: 42 } }]]);
    const schema = z.object({ id: z.string(), label: z.string() });
    expect(readNodeDetail(cache, 'k|n', 'node', schema)?.error).toBeInstanceOf(Error);
  });
});

describe('useNodeDetail', () => {
  it('runs the named query with nodeId and selects the path', async () => {
    const { client, query } = clientReturning({ node: { id: 'n1', label: 'Ada' } });
    const { result } = renderHook(
      () => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n1', cache: new Map() }),
      { wrapper: wrap(client) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledWith(spec.queries.detail.query, { static: 'x', nodeId: 'n1' }, undefined);
    expect(result.current.data).toEqual({ id: 'n1', label: 'Ada' });
  });

  it('honours a query source instead of the GraphQL client', async () => {
    const { client, query } = clientReturning(undefined);
    const run = vi.fn(async (_text: string, _variables: Record<string, unknown>) => ({ node: { id: 'n2', label: 'Pharo' } }));
    const sources = new Map<string, DataSource>([['pharo', { id: 'pharo', run }]]);
    const { result } = renderHook(
      () => useNodeDetail({ queryKey: 'remote', path: 'node', nodeId: 'n2', cache: new Map() }),
      { wrapper: wrap(client, sources) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(run).toHaveBeenCalledWith('details', { nodeId: 'n2' });
    expect(query).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ id: 'n2', label: 'Pharo' });
  });

  it('validates and transforms the selected detail with a schema', async () => {
    const { client } = clientReturning({ node: { id: 'n3', label: 'Ada', extra: true } });
    const schema = z.object({ id: z.string(), label: z.string().default('anon') });
    const { result } = renderHook(
      () => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n3', schema, cache: new Map() }),
      { wrapper: wrap(client) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: 'n3', label: 'Ada' });

    const failing = z.object({ id: z.string(), label: z.number() });
    const bad = clientReturning({ node: { id: 'n4', label: 'Ada' } });
    const invalid = renderHook(
      () => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n4', schema: failing, cache: new Map() }),
      { wrapper: wrap(bad.client) },
    );
    await waitFor(() => expect(invalid.result.current.loading).toBe(false));
    expect(invalid.result.current.data).toBeUndefined();
    expect(invalid.result.current.error).toBeInstanceOf(Error);
  });

  it('does not fetch when disabled or without a nodeId', async () => {
    const { client, query } = clientReturning({ node: { id: 'n5' } });
    const disabled: { opts: NodeDetailOptions } = { opts: { queryKey: 'detail', nodeId: 'n5', enabled: false, cache: new Map() } };
    const { rerender } = renderHook(({ opts }) => useNodeDetail(opts), {
      wrapper: wrap(client),
      initialProps: disabled,
    });
    await act(async () => {});
    expect(query).not.toHaveBeenCalled();
    rerender({ opts: { queryKey: 'detail', cache: new Map() } });
    await act(async () => {});
    expect(query).not.toHaveBeenCalled();
  });

  it('reuses a supplied cache instead of fetching the same node twice', async () => {
    const { client, query } = clientReturning({ node: { id: 'n6', label: 'Ada' } });
    const cache = new Map<string, unknown>();
    const wrapper = wrap(client);
    const first = renderHook(() => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n6', cache }), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n6', cache }), { wrapper });
    expect(second.result.current.data).toEqual({ id: 'n6', label: 'Ada' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a detail across two views using the same query key', async () => {
    const { client, query } = clientReturning({ node: { id: 'n7', label: 'Ada' } });
    const cache = new Map<string, unknown>();
    const first = renderHook(
      () => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n7', cache }),
      { wrapper: wrap(client) },
    );
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    const second = renderHook(
      () => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: 'n7', cache }),
      { wrapper: wrap(client, new Map(), { ...spec, id: 'other-view' }) },
    );
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('ignores answers that arrive out of order', async () => {
    const { client, pending } = deferredClient();
    const cache = new Map<string, unknown>();
    const { result, rerender } = renderHook(
      ({ id }) => useNodeDetail({ queryKey: 'detail', path: 'node', nodeId: id, cache }),
      { wrapper: wrap(client), initialProps: { id: 'old' } },
    );
    await waitFor(() => expect(pending).toHaveLength(1));
    rerender({ id: 'fresh' });
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => pending[1]?.({ data: { node: { id: 'fresh' } } }));
    await act(async () => pending[0]?.({ data: { node: { id: 'old' } } }));
    expect(result.current.data).toEqual({ id: 'fresh' });
  });
});

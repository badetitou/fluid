import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider, type Client } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import { useViewData } from './useViewData';

/** A client whose answers resolve only when the test says so. */
function deferredClient() {
  const pending: ((data: unknown) => void)[] = [];
  const client = {
    query: () => ({ toPromise: () => new Promise((resolve) => pending.push((data) => resolve({ data }))) }),
  } as unknown as Client;
  return { client, answer: (data: unknown) => act(async () => pending.shift()?.(data)) };
}

const spec = (id: string): ViewSpec => ({
  version: 1,
  id: 'v',
  concept: 'Character',
  title: 'Character',
  queries: { item: { query: 'query ($id: ID!) { character(id: $id) { name } }', variables: { id } } },
  widgets: [],
});

describe('useViewData', () => {
  it('keeps the previous results on screen while another item loads', async () => {
    const { client, answer } = deferredClient();
    const wrapper = ({ children }: { children: ReactNode }) => <Provider value={client}>{children}</Provider>;
    const { result, rerender } = renderHook(({ s }) => useViewData(s), { wrapper, initialProps: { s: spec('1') } });

    expect(result.current.fetching).toBe(true);
    await answer({ character: { name: 'Rick' } });
    await waitFor(() => expect(result.current.fetching).toBe(false));

    rerender({ s: spec('2') });
    expect(result.current).toMatchObject({ fetching: false, refreshing: true, results: { item: { character: { name: 'Rick' } } } });

    await answer({ character: { name: 'Morty' } });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.results).toEqual({ item: { character: { name: 'Morty' } } });
  });
});

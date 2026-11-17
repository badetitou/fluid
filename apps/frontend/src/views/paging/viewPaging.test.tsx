import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import { RowPagingContext } from '../plugin-api/rowPaging';
import { ViewRenderer } from '../ViewRenderer';

const TOTAL = 50;

// A source of 50 methods answering `take` rows after `fluidSkip`.
const client = {
  query: (_query: string, vars: { take?: number; fluidSkip?: number }) => {
    const skip = vars.fluidSkip ?? 0;
    const n = Math.max(0, Math.min(vars.take ?? TOTAL, TOTAL - skip));
    const methods = Array.from({ length: n }, (_, i) => ({ id: String(skip + i), name: `m${skip + i}` }));
    return { toPromise: () => Promise.resolve({ data: { methods } }) };
  },
} as unknown as Client;

const spec: ViewSpec = {
  version: 1,
  id: 'v',
  concept: 'Method',
  title: 'Methods',
  queries: { rows: { query: 'query M($take: Int) { methods(take: $take) { id name } }', variables: { take: 100 } } },
  widgets: [
    { id: 'count', type: 'statistic', title: 'Count', data: { query: 'rows', path: 'methods' }, value: { op: 'count' } },
    { id: 'list', type: 'table', data: { query: 'rows', path: 'methods' }, columns: [{ key: 'name' }] },
  ],
};

const renderView = () =>
  render(
    <MemoryRouter>
      <Provider value={client}>
        <RowPagingContext.Provider value={{ rowLimit: 20, offsetArg: 'skip', confirmLoadAll: true, stopConfirmingLoadAll: () => {} }}>
          <ViewRenderer spec={spec} />
        </RowPagingContext.Provider>
      </Provider>
    </MemoryRouter>,
  );

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

describe('paging a view', () => {
  it('loads the row limit, shows one banner per query, and loads more on demand', async () => {
    renderView();
    expect(await screen.findAllByText('First 20 rows — there may be more.')).toHaveLength(1);
    expect(screen.getByText('20')).toBeTruthy(); // the statistic counts the rows loaded

    fireEvent.click(screen.getByRole('button', { name: 'Load 20 more' }));
    expect(await screen.findByText('First 40 rows — there may be more.')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();

    // Found by its text: once it has been loading, antd's button no longer exposes this accessible name.
    const more = screen.getByText('Load 20 more').closest('button')!;
    await waitFor(() => expect(more.disabled).toBe(false));
    fireEvent.click(more);
    // Only 10 left: the list is complete, the banner goes.
    expect(await screen.findByText('50', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(/there may be more/)).toBeNull();
  });
});

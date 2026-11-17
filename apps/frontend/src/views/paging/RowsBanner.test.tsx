import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RowPagingContext, type RowPagingContextValue } from '../plugin-api/rowPaging';
import type { RowsState } from './model';
import { RowsBanner } from './RowsBanner';

const ROWS: RowsState = { loaded: 300, truncated: true, step: 300, paged: true, more: true };

function renderBanner(rows: RowsState, paging: Partial<RowPagingContextValue> = {}) {
  const load = vi.fn(async () => {});
  const stopConfirmingLoadAll = vi.fn();
  render(
    <RowPagingContext.Provider value={{ confirmLoadAll: true, stopConfirmingLoadAll, ...paging }}>
      <RowsBanner rows={rows} load={load} />
    </RowPagingContext.Provider>,
  );
  return { load, stopConfirmingLoadAll };
}

beforeAll(() => {
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

describe('RowsBanner', () => {
  it('loads more rows', () => {
    const { load } = renderBanner(ROWS);
    expect(screen.getByText(/First 300 rows/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load 300 more' }));
    expect(load).toHaveBeenCalledWith('more');
  });

  it('asks before loading all, and stops asking with "Don\'t ask again"', async () => {
    const { load, stopConfirmingLoadAll } = renderBanner(ROWS);
    fireEvent.click(screen.getByRole('button', { name: 'Load all' }));
    expect(load).not.toHaveBeenCalled();
    expect(await screen.findByText('Load every row?')).toBeTruthy();
    expect(screen.getByText(/read page by page/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Don't ask again/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Load all' }).at(-1)!);
    await waitFor(() => expect(load).toHaveBeenCalledWith('all'));
    expect(stopConfirmingLoadAll).toHaveBeenCalled();
  });

  it('loads all at once when the source no longer asks', () => {
    const { load } = renderBanner(ROWS, { confirmLoadAll: false });
    fireEvent.click(screen.getByRole('button', { name: 'Load all' }));
    expect(load).toHaveBeenCalledWith('all');
    expect(screen.queryByText('Load every row?')).toBeNull();
  });

  it('says the dialog asks every row at once when the source cannot page', async () => {
    renderBanner({ ...ROWS, paged: false });
    fireEvent.click(screen.getByRole('button', { name: 'Load all' }));
    expect(await screen.findByText(/cannot page/)).toBeTruthy();
  });

  it('offers nothing to load when the source can give no more', () => {
    renderBanner({ ...ROWS, loaded: 1000, paged: false, more: false });
    expect(screen.getByText(/answers no more at once/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

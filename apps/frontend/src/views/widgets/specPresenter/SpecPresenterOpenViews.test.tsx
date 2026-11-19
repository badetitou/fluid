import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SpecPresenterWidget as SpecPresenterWidgetSpec, ViewNode, ViewSpec } from '@fluid/shared';
import { DataSourcesContext, type DataSource } from '../../plugin-api/dataSources';
import { RenderedViewContext } from '../../plugin-api/viewContext';
import { SpecPresenterWidget } from './SpecPresenterWidget';

// The Open Views kinds and behaviours on a widget bound to a data source:
// lists, tabs, forwards, lazy items and view actions.

const widget: SpecPresenterWidgetSpec = { id: 'v', type: 'specPresenter', data: { query: 'v' } };
const spec: ViewSpec = {
  version: 1,
  id: 'ov',
  concept: 'Class',
  title: 'Open view',
  queries: { v: { source: 'ov', query: 'view', variables: { id: 'o1', view: 'k' } } },
  widgets: [widget],
};
const cell = (text: string, ref?: { id: string; type?: string }) => ({ cells: [{ text, ...(ref ? { ref } : {}) }] });

type Answers = (query: string, variables: Record<string, unknown>) => unknown;

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderWidget(data: unknown, answers?: Answers) {
  const run = vi.fn<DataSource['run']>((query, variables) => Promise.resolve(answers?.(query, variables)));
  const sources = new Map<string, DataSource>(answers ? [['ov', { id: 'ov', run }]] : []);
  const emit = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <RenderedViewContext.Provider value={spec}>
        <DataSourcesContext.Provider value={sources}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <SpecPresenterWidget widget={widget} data={data} emit={emit} />
                  <Location />
                </>
              }
            />
          </Routes>
        </DataSourcesContext.Provider>
      </RenderedViewContext.Provider>
    </MemoryRouter>,
  );
  return { ...view, run, emit };
}

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

describe('Open Views kinds', () => {
  it('draws a list without a header, its items linking their entity', () => {
    const { container } = renderWidget({ kind: 'list', items: [cell('printOn:', { id: 'm1', type: 'Method' })] });
    expect(screen.getByRole('link', { name: /printOn:/ })).toBeTruthy();
    expect(container.querySelector('thead')).toBeNull();
  });

  it('draws tabs, open on the selected one', () => {
    const node: ViewNode = {
      kind: 'tabs',
      selected: 1,
      tabs: [
        { title: 'Items', node: { kind: 'list', items: [cell('a')] } },
        { title: 'Source', node: { kind: 'text', text: 'size ^ tally' } },
      ],
    };
    renderWidget(node);
    expect(screen.getByRole('tab', { name: 'Source', selected: true })).toBeTruthy();
    expect(screen.getByText('size ^ tally')).toBeTruthy();
  });

  it('draws the named view of a forwarded object, loaded from the same source', async () => {
    const { run } = renderWidget({ kind: 'forward', ref: { id: 'c2', type: 'Class' }, view: 'src' }, (query) =>
      query === 'view' ? { key: 'src', title: 'Source', priority: 1, view: { kind: 'text', text: 'Object subclass: #C2' } } : undefined,
    );
    expect(await screen.findByText('Object subclass: #C2')).toBeTruthy();
    expect(run).toHaveBeenCalledWith('view', { id: 'c2', view: 'src' });
  });

  it('draws every view of a forwarded object as tabs, by priority', async () => {
    renderWidget({ kind: 'forward', ref: { id: 'c2' } }, (query, variables) =>
      query === 'views'
        ? { object: { id: 'c2' }, views: [{ key: 'b', title: 'Second', priority: 2 }, { key: 'a', title: 'First', priority: 1 }] }
        : { key: variables.view, title: '', priority: 0, view: { kind: 'label', text: `view ${String(variables.view)}` } },
    );
    expect(await screen.findByText('view a')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['First', 'Second']);
  });

  it('links a forwarded object when there is no source to load its views from', () => {
    renderWidget({ kind: 'forward', ref: { id: 'c2', type: 'Class' } });
    expect(screen.getByRole('link', { name: /c2/ })).toBeTruthy();
  });
});

describe('lazy items', () => {
  it('loads the next page of a list with a total', async () => {
    const { run } = renderWidget({ kind: 'list', items: [cell('a')], total: 2 }, () => ({ items: [cell('b')], total: 2 }));
    expect(screen.getByText(/1 of 2 shown/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('b')).toBeTruthy();
    expect(run).toHaveBeenCalledWith('items', { id: 'o1', view: 'k', path: '0', offset: 1 });
    expect(screen.queryByText(/shown/)).toBeNull();
  });

  it('loads every item of a lazy node, named by its place among the pageable nodes', async () => {
    const node: ViewNode = {
      kind: 'composite',
      direction: 'column',
      children: [
        { kind: 'list', items: [cell('first')] },
        { kind: 'columnedList', columns: [{ title: 'Name' }], items: [], lazy: true },
      ],
    };
    const { run } = renderWidget(node, () => ({ items: [cell('loaded')] }));
    expect(await screen.findByText('loaded')).toBeTruthy();
    expect(run).toHaveBeenCalledWith('items', { id: 'o1', view: 'k', path: '1', offset: 0 });
  });

  it('loads the children of a tree item when it is unfolded', async () => {
    const node: ViewNode = { kind: 'tree', roots: [cell('root'), { ...cell('pkg'), hasChildren: true }] };
    const { container, run } = renderWidget(node, () => ({ items: [cell('Collections-Abstract')] }));
    const expand = container.querySelectorAll('.ant-table-row-expand-icon:not(.ant-table-row-expand-icon-spaced)');
    expect(expand).toHaveLength(1);
    fireEvent.click(expand[0]);
    expect(await screen.findByText('Collections-Abstract')).toBeTruthy();
    expect(run).toHaveBeenCalledWith('items', { id: 'o1', view: 'k', path: '0.1', offset: 0 });
  });

  it('says so when a lazy node has no source to load from', () => {
    renderWidget({ kind: 'list', items: [], lazy: true });
    expect(screen.getByText(/No data source to load/)).toBeTruthy();
  });
});

describe('view actions', () => {
  const view = (text: string) => ({
    key: 'k',
    title: 'K',
    priority: 1,
    view: { kind: 'label', text },
    actions: [
      { id: 'reload', label: 'Reload' },
      { id: 'go', label: 'Open parent' },
    ],
  });

  it('runs an action and reloads the view when it answers `refresh`', async () => {
    const { run } = renderWidget(view('before'), (query) => (query === 'action' ? { refresh: true } : view('after')));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByText('after')).toBeTruthy();
    expect(run).toHaveBeenCalledWith('action', { id: 'o1', view: 'k', action: 'reload' });
    expect(run).toHaveBeenLastCalledWith('view', { id: 'o1', view: 'k' });
  });

  it('opens the entity an action answers with', async () => {
    const { emit } = renderWidget(view('x'), () => ({ ref: { id: 'p1', type: 'Package' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Open parent' }));
    await waitFor(() => expect(emit).toHaveBeenCalledWith('selected', { id: 'p1', type: 'Package' }));
    expect(screen.getByTestId('location').textContent).toMatch(/p1/);
  });

  it('disables the actions without a source to run them on', () => {
    renderWidget(view('x'));
    expect((screen.getByRole('button', { name: 'Reload' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

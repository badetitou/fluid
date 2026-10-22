import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import { createPluginHost } from '../../entities/plugin/host';
// The example plugin served from `public/plugins/`, loaded as fluid loads any plugin module.
import tagcloudPlugin from '../../../public/plugins/tagcloud/index.js';
import { ViewRenderer } from '../ViewRenderer';
import { builtinWidgetCatalog } from '../widgets/catalog';
import { WidgetCatalogContext } from './catalogContext';
import type { WidgetCatalog, WidgetProps } from './types';

const characters = [
  { id: '1', name: 'Rick', species: 'Human' },
  { id: '2', name: 'Morty', species: 'Human' },
  { id: '3', name: 'Zeep', species: 'Alien' },
];

const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { characters } }) }),
} as unknown as Client;

const view = (widgets: ViewSpec['widgets']): ViewSpec => ({
  version: 1,
  id: 'v',
  concept: 'Character',
  title: 'Characters',
  queries: { rows: { query: '{ characters { id name species } }' } },
  widgets,
});

const renderView = (spec: ViewSpec, catalog?: WidgetCatalog) =>
  render(
    <MemoryRouter>
      <Provider value={client}>
        <WidgetCatalogContext.Provider value={catalog ?? null}>
          <ViewRenderer spec={spec} />
        </WidgetCatalogContext.Provider>
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

describe('widget outputs', () => {
  it('feeds the row clicked in a table to a widget bound to `@<tableId>`', async () => {
    renderView(
      view([
        {
          id: 'people',
          type: 'table',
          data: { query: 'rows', path: 'characters' },
          columns: [{ key: 'name' }],
        },
        {
          id: 'detail',
          type: 'descriptions',
          title: 'Selected',
          data: { query: '@people', path: 'selected' },
          items: [{ label: 'Species', key: 'species' }],
        },
      ]),
    );
    fireEvent.click(await screen.findByText('Zeep'));
    expect(await screen.findByText('Alien')).toBeTruthy();
  });
});

describe('plugin widgets', () => {
  it('renders a plugin module’s widget and wires its output to a built-in widget', async () => {
    const provided = tagcloudPlugin(createPluginHost()) as {
      widgets: Record<string, { Render: WidgetProps['widget'] }>;
    };
    const builtin = builtinWidgetCatalog();
    const catalog: WidgetCatalog = {
      ...builtin,
      renderers: new Map([
        ...builtin.renderers,
        [
          'tagcloud/cloud',
          { type: 'tagcloud/cloud', Render: provided.widgets['tagcloud/cloud'].Render as never },
        ],
      ]),
    };
    renderView(
      view([
        {
          id: 'species',
          type: 'tagcloud/cloud',
          data: { query: 'rows', path: 'characters' },
          field: 'species',
        },
        {
          id: 'members',
          type: 'table',
          title: 'Members',
          data: { query: '@species', path: 'selected.rows' },
          columns: [{ key: 'name' }],
        },
      ]),
      catalog,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Alien' }));
    const table = (await screen.findByText('Zeep')).closest('table') as HTMLElement;
    expect(within(table).queryByText('Rick')).toBeNull();
  });

  it('stands in for a widget no active plugin renders', async () => {
    renderView(view([{ id: 'w', type: 'acme/gauge', data: { query: 'rows' } }]));
    expect(await screen.findByText('Widget “acme/gauge” unavailable')).toBeTruthy();
  });
});

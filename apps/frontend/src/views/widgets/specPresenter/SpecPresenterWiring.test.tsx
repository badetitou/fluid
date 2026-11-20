import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { specPresenterWidgetExample, type ViewSpec } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { methodsTable } from './specPresenterFixture';

// End to end: an Open View emitting the clicked entity on `selected`, read
// by a descriptions widget bound to `@tab`.
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { key: 'methods', title: 'Methods', priority: 1, view: methodsTable } }) }),
} as unknown as Client;

const spec: ViewSpec = {
  version: 1,
  id: 'v',
  concept: 'Class',
  title: 'Fame',
  queries: { view: { query: 'view' } },
  widgets: [
    specPresenterWidgetExample,
    {
      id: 'selection',
      type: 'descriptions',
      data: { query: '@tab', path: 'selected' },
      items: [
        { label: 'Selected id', key: 'id' },
        { label: 'Selected type', key: 'type' },
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

describe('spec presenter wiring', () => {
  it('feeds the clicked entity to the widget bound to `@tab`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={spec} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('size'));
    expect(await screen.findByText('m3')).toBeTruthy();
  });
});

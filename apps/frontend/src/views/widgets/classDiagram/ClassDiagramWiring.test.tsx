import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { classDiagramExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { pharoClasses } from './classDiagramFixture';

// End to end: the curated view, its class diagram emitting the clicked class on
// `selected`, read by the descriptions widget bound to `@hierarchy`.
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { classes: pharoClasses } }) }),
} as unknown as Client;

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

const unfolded = {
  ...classDiagramExample,
  widgets: classDiagramExample.widgets.map((w) => (w.type === 'classDiagram' ? { ...w, expandDepth: 10 } : w)),
};

describe('class diagram wiring', () => {
  it('feeds the clicked class to the widget bound to `@hierarchy`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={unfolded} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Set' }));
    expect(await screen.findByText('42')).toBeTruthy();
  });
});

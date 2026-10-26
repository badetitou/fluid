import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { butterflyExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { centerMethod } from './butterflyFixture';

// End to end: the curated view, its butterfly emitting the clicked neighbour on
// `selected`, read by the descriptions widget bound to `@calls`.
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { method: centerMethod } }) }),
} as unknown as Client;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 640, height: 400 }) as DOMRect;
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

describe('butterfly wiring', () => {
  it('feeds the clicked neighbour to the widget bound to `@calls`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={butterflyExample} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /printOn:/ }));
    expect(await screen.findByText('12')).toBeTruthy();
  });
});

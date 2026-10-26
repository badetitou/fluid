import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { blueprintExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { orderedCollection } from './blueprintFixture';

// End to end: the curated view, its blueprint emitting the clicked method on
// `selected`, read by the descriptions widget bound to `@blueprint`.
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: { class: orderedCollection } }) }),
} as unknown as Client;

beforeAll(() => {
  // jsdom has no layout: the view grid measures its width, antd reads media queries.
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

describe('blueprint wiring', () => {
  it('feeds the clicked method to the widget bound to `@blueprint`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={blueprintExample} />
        </Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('growing')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /^growAtLast/ }));
    expect(await screen.findByText('growing')).toBeTruthy();
  });
});

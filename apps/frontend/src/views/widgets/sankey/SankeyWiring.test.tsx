import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { characterFlowSankeyExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { rickAndMortyCharacters } from './sankeyFixture';

// End to end: the curated view, its sankey emitting the clicked node on
// `selected`, whose rows the table bound to `@flows` lists.
const client = {
  query: () => ({
    toPromise: () => Promise.resolve({ data: { characters: { results: rickAndMortyCharacters } } }),
  }),
} as unknown as Client;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 400 }) as DOMRect;
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

describe('sankey wiring', () => {
  it('feeds the rows of the clicked node to the table bound to `@flows`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={characterFlowSankeyExample} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Dead: 1' }));
    expect(await screen.findByText('Adjudicator Rick')).toBeTruthy();
    expect(screen.queryByText('Morty Smith')).toBeNull();
  });
});

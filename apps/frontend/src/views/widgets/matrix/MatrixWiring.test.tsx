import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { characterEpisodesMatrixExample } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { rickAndMortyCharacters } from './matrixFixture';

// End to end: the curated view, its matrix emitting the clicked cell on `selected`,
// read by the descriptions widget bound to `@appearances` (path "selected.target").
const client = {
  query: () => ({ toPromise: () => Promise.resolve({ data: rickAndMortyCharacters }) }),
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
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 700, height: 400, left: 0, top: 0 }) as DOMRect;
});
afterEach(cleanup);

describe('matrix wiring', () => {
  it('feeds the clicked cell to the widget bound to `@appearances`', async () => {
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={characterEpisodesMatrixExample} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Rick Sanchez → S01E03: 1' }));
    expect(await screen.findByText('Anatomy Park')).toBeTruthy();
  });
});

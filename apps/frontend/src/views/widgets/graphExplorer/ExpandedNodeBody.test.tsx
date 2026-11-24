import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GRAPH_NODE_QUERY, type Widget } from '@fluid/shared';
import { scopedResolver } from '../../data';
import { ExpandedNodeBody } from './ExpandedNodeBody';

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

const card = {
  id: 'card',
  type: 'descriptions',
  data: { query: GRAPH_NODE_QUERY },
  columns: 1,
  items: [{ key: 'name', label: 'Name' }],
} as Widget;

describe('expanded node body', () => {
  it('renders real fluid widgets reading the expanded node through `$node`', async () => {
    const resolve = scopedResolver({ [GRAPH_NODE_QUERY]: { name: 'Alpha' } }, () => undefined);
    render(
      <MemoryRouter>
        <ExpandedNodeBody widgets={[card]} nodeKey="alpha" resolve={resolve} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Alpha')).toBeTruthy();
  });

  it('says when the explorer has no nested widget to show', () => {
    render(
      <MemoryRouter>
        <ExpandedNodeBody widgets={[]} nodeKey="alpha" resolve={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No detail widget/)).toBeTruthy();
  });
});

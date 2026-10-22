/**
 * Regression tests for MillerListView.
 *
 * The page previously crashed into a blank full-screen because useViews was
 * called conditionally inside a loop (Rules of Hooks violation): growing the
 * navigation stack changed the hook count and React tore down the whole tree.
 *
 * Each column is now its own <MillerColumn> component, so a variable number of
 * columns can never change the hook count of a single component. These tests
 * mock the columns to keep the render lightweight and assert the structure:
 * a dashboard alone is a page, followed links turn it into Miller columns.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let mounts = 0;
vi.mock('./MillerColumn', async () => {
  const { useState } = await import('react');
  return {
    MillerColumn: ({ column, mode }: { column: { path: string }; mode: string }) => {
      // Numbered once per mount: a column updated in place keeps its number.
      const [mount] = useState(() => ++mounts);
      return (
        <div data-testid="miller-column" data-mode={mode} data-mount={mount}>
          {column.path}
        </div>
      );
    },
  };
});
vi.mock('./ConceptsColumn', () => ({
  ConceptsColumn: ({ mode }: { mode: string }) => <div data-testid="concepts-column" data-mode={mode} />,
}));

// Import after the mocks are registered.
import { MillerListView } from './MillerListView';
import { buildColumns } from './model';

function tree(stack: { concept: string; itemId?: string }[], root = 'Account') {
  const columns = buildColumns(root, { kind: 'concept', conceptName: root }, stack);
  return (
    <MemoryRouter>
      <MillerListView columns={columns} />
    </MemoryRouter>
  );
}

const modes = (els: HTMLElement[]) => els.map((e) => e.dataset.mode);

describe('MillerListView', () => {
  it('shows a dashboard alone as a page', () => {
    const { getAllByTestId } = render(tree([]));
    expect(modes(getAllByTestId('miller-column'))).toEqual(['page']);
  });

  it('turns into columns once a link is followed, without crashing as depth grows', () => {
    const { getAllByTestId, rerender } = render(tree([]));
    expect(getAllByTestId('miller-column')).toHaveLength(1);

    rerender(tree([{ concept: 'Customer', itemId: 'C1' }]));
    expect(modes(getAllByTestId('miller-column'))).toEqual(['column', 'column']);

    rerender(
      tree([
        { concept: 'Customer', itemId: 'C1' },
        { concept: 'Order', itemId: 'O1' },
      ]),
    );
    expect(getAllByTestId('miller-column')).toHaveLength(3);

    // Shrinking back down must also be safe.
    rerender(tree([]));
    expect(modes(getAllByTestId('miller-column'))).toEqual(['page']);
  });

  it('renders a column per level even before its concept is introspected', () => {
    // Concepts are introspected lazily by each column, which reports unknown
    // types itself; the view no longer needs the schema up front.
    const { getAllByTestId } = render(tree([{ concept: 'DoesNotExist', itemId: 'X' }]));
    expect(getAllByTestId('miller-column')).toHaveLength(2);
  });

  it('starts from the Concepts page', () => {
    const columns = buildColumns('@home', { kind: 'home' }, [{ concept: 'Order' }]);
    const { getByTestId, getAllByTestId } = render(
      <MemoryRouter>
        <MillerListView columns={columns} />
      </MemoryRouter>,
    );
    expect(getByTestId('concepts-column').dataset.mode).toBe('column');
    expect(getAllByTestId('miller-column')).toHaveLength(1);
  });

  it('updates a column in place when it opens another item of the same concept', () => {
    const { getAllByTestId, rerender } = render(tree([{ concept: 'Customer', itemId: 'C1' }]));
    const before = getAllByTestId('miller-column')[1];
    const mount = before.dataset.mount;

    rerender(tree([{ concept: 'Customer', itemId: 'C2' }]));
    const after = getAllByTestId('miller-column')[1];
    expect(after.textContent).toBe('/d/Account/Customer@C2');
    expect(after.dataset.mount).toBe(mount);

    // Another concept at that position is another column.
    rerender(tree([{ concept: 'Order', itemId: 'O1' }]));
    expect(getAllByTestId('miller-column')[1].dataset.mount).not.toBe(mount);
  });
});

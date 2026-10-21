/**
 * Regression tests for MillerListView.
 *
 * The page previously crashed into a blank full-screen because useViews was
 * called conditionally inside a loop (Rules of Hooks violation): growing the
 * navigation stack changed the hook count and React tore down the whole tree.
 *
 * Each column is now its own <MillerColumn> component, so a variable number of
 * columns can never change the hook count of a single component. These tests
 * mock MillerColumn to keep the render lightweight and assert the structure.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./MillerColumn', () => ({
  MillerColumn: ({ path }: { path: string }) => <div data-testid="miller-column">{path}</div>,
}));

// Import after the mock is registered.
import { MillerListView } from './MillerListView';

interface NavNode {
  conceptName: string;
  itemId: string;
}

function tree(stack: NavNode[]) {
  return (
    <MemoryRouter>
      <MillerListView rootConceptName="Account" navigationStack={stack} />
    </MemoryRouter>
  );
}

describe('MillerListView', () => {
  it('renders a single column at the root', () => {
    const { getAllByTestId } = render(tree([]));
    expect(getAllByTestId('miller-column')).toHaveLength(1);
  });

  it('adds a column per navigation level without crashing as depth grows', () => {
    const { getAllByTestId, rerender } = render(tree([]));
    expect(getAllByTestId('miller-column')).toHaveLength(1);

    rerender(tree([{ conceptName: 'Customer', itemId: 'C1' }]));
    expect(getAllByTestId('miller-column')).toHaveLength(2);

    rerender(
      tree([
        { conceptName: 'Customer', itemId: 'C1' },
        { conceptName: 'Order', itemId: 'O1' },
      ]),
    );
    expect(getAllByTestId('miller-column')).toHaveLength(3);

    // Shrinking back down must also be safe.
    rerender(tree([]));
    expect(getAllByTestId('miller-column')).toHaveLength(1);
  });

  it('renders a column per level even before its concept is introspected', () => {
    // Concepts are introspected lazily by each column, which reports unknown
    // types itself; the view no longer needs the schema up front.
    const { getAllByTestId } = render(tree([{ conceptName: 'DoesNotExist', itemId: 'X' }]));
    expect(getAllByTestId('miller-column')).toHaveLength(2);
  });
});

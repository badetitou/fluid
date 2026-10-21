import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { continentTreeExample, type TreeWidget as TreeWidgetSpec } from '@fluid/shared';
import { TreeWidget } from './TreeWidget';

const data = [{ code: 'EU', name: 'Europe', capital: null, countries: [{ code: 'FR', name: 'France', capital: 'Paris', states: [] }] }];
const [listSpec, tableSpec] = continentTreeExample.widgets as TreeWidgetSpec[];

const renderWidget = (widget: TreeWidgetSpec) =>
  render(
    <MemoryRouter>
      <TreeWidget widget={widget} data={data} />
    </MemoryRouter>,
  );

// antd's Tree and Table measure the page, which jsdom does not implement.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= (query: string) =>
    ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
});
afterEach(cleanup);

describe('TreeWidget', () => {
  it('renders the example as a file-explorer tree, first level expanded', () => {
    renderWidget(listSpec);
    expect(screen.getByText('Europe')).toBeTruthy();
    expect(screen.getByText('France')).toBeTruthy();
  });

  it('renders the example as an expandable table when it has columns', () => {
    const { container } = renderWidget(tableSpec);
    expect(container.querySelector('.ant-table')).toBeTruthy();
    expect(screen.getByText('Paris')).toBeTruthy();
  });

  it('shows an empty state without data', () => {
    const { container } = render(<TreeWidget widget={listSpec} data={[]} />);
    expect(container.querySelector('.ant-empty-description')?.textContent).toBe('No data');
  });
});

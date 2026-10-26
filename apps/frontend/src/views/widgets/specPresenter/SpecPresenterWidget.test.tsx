import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { specPresenterWidgetExample, type SpecFluidNode } from '@fluid/shared';
import { OpenableConceptsContext } from '../../../navigation/columnPath';
import { SpecPresenterWidget } from './SpecPresenterWidget';
import { fameTab, hierarchySvg, methodDiff, methodsTable, sourceNotebook } from './specPresenterFixture';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (data: unknown, openable: ReadonlySet<string> | null = null) => {
  const emit = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <OpenableConceptsContext.Provider value={openable}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <SpecPresenterWidget widget={specPresenterWidgetExample} data={data} emit={emit} />
                <Location />
              </>
            }
          />
        </Routes>
      </OpenableConceptsContext.Provider>
    </MemoryRouter>,
  );
  return { ...view, emit };
};

const location = () => screen.getByTestId('location').textContent ?? '';

beforeAll(() => {
  // jsdom has no layout: antd's sticky table header observes its size.
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

describe('SpecPresenterWidget', () => {
  it('draws every kind of node of a tab: table, tree, svg, text, unsupported', () => {
    const { container } = renderWidget(fameTab);
    expect(screen.getAllByText('Method').length).toBeGreaterThan(0);
    expect(screen.getByText('Pharo sent only the first rows.')).toBeTruthy();
    expect(screen.getByText('Collections-Abstract')).toBeTruthy();
    expect(screen.getByTitle('Pharo has more children than it sent')).toBeTruthy();
    expect(container.querySelector('pre')?.textContent).toContain('aStream << self name');
    expect(screen.getByText('SpRoassalInspectorPresenter')).toBeTruthy();
    expect(container.querySelector('svg script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });

  it('opens a cell entity in the next column and emits it on `selected`', () => {
    const { emit } = renderWidget(methodsTable);
    fireEvent.click(screen.getByRole('link', { name: /printOn:/ }));
    expect(location()).toMatch(/^\/d\/Class\/.*Method.*m1/);
    expect(emit).toHaveBeenCalledWith('selected', { id: 'm1', type: 'Method' });
  });

  it('emits the entity of a clicked row and highlights it', () => {
    const { emit } = renderWidget(methodsTable);
    const row = screen.getByText('size').closest('tr') as HTMLElement;
    fireEvent.click(row);
    expect(emit).toHaveBeenCalledWith('selected', { id: 'm3', type: 'Method' });
    expect(row.className).toMatch(/selected/);
  });

  it('links only the entities whose type the source can open', () => {
    renderWidget(methodsTable, new Set(['Class']));
    expect(screen.queryByRole('link', { name: /printOn:/ })).toBeNull();
    expect(screen.getByText('printOn:')).toBeTruthy();
  });

  it('opens the svg entities, drawn ones by click and hotspots by Enter', () => {
    const { container, emit } = renderWidget(hierarchySvg);
    fireEvent.click(screen.getByText('Collection'));
    expect(emit).toHaveBeenCalledWith('selected', { id: 'c1', type: 'Class' });
    expect(location()).toMatch(/c1/);
    fireEvent.keyDown(container.querySelector('[data-fluid-hotspot]') as Element, { key: 'Enter' });
    expect(emit).toHaveBeenLastCalledWith('selected', { id: 'c2', type: 'Class' });
    expect(location()).toMatch(/c2/);
  });

  it('explains a missing or invalid document instead of an empty frame', () => {
    renderWidget(undefined);
    expect(screen.getByText(/returned nothing/)).toBeTruthy();
    cleanup();
    renderWidget({ kind: 'chart' } as unknown as SpecFluidNode);
    expect(screen.getByText(/Not a Spec-Fluid document/)).toBeTruthy();
  });

  it('marks the highlighted part of a text, as Pharo selects an entity in its source', () => {
    const text = 'abstract class Animal {\n    abstract makeSound(): void;\n}';
    const start = text.indexOf('abstract makeSound');
    const { container } = renderWidget({ kind: 'text', text, highlights: [{ start, end: start + 26 }] });
    expect(container.querySelector('mark')?.textContent).toBe('abstract makeSound(): void');
    expect(container.querySelector('pre')?.textContent).toBe(text);
  });

  it('draws a notebook as tabs, open on the page Pharo selected', () => {
    const { container } = renderWidget(sourceNotebook);
    expect(screen.getByRole('tab', { name: 'Source', selected: true })).toBeTruthy();
    expect(container.querySelector('pre')?.textContent).toBe('size\n\t^ tally');
    fireEvent.click(screen.getByRole('tab', { name: 'Methods' }));
    expect(screen.getByRole('link', { name: /printOn:/ })).toBeTruthy();
  });

  it('draws a diff with the code widget: removed and added lines', async () => {
    renderWidget(methodDiff);
    expect(await screen.findByText(/array size/)).toBeTruthy();
    expect(screen.getByText(/tally/)).toBeTruthy();
    expect(screen.getByText(/parent/)).toBeTruthy();
  });

  it('says when an svg node is not an SVG document', () => {
    renderWidget({ kind: 'svg', svg: '<div>nope</div>' });
    expect(screen.getByText('This visualization is not a valid SVG document.')).toBeTruthy();
  });
});

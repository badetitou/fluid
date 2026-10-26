import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { boxesExample, type BoxesWidget as BoxesWidgetSpec } from '@fluid/shared';
import { ViewRenderer } from '../../ViewRenderer';
import { BoxesWidget } from './BoxesWidget';
import { boxClasses } from './boxesFixture';

const spec = boxesExample.widgets[0] as BoxesWidgetSpec;

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: BoxesWidgetSpec, data: unknown, emit = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <Routes>
        <Route path="*" element={<><BoxesWidget widget={widget} data={data} emit={emit} /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return emit;
};

// jsdom has no layout: give the frame a width so the drawing renders.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 800, height: 400 }) as DOMRect;
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

describe('BoxesWidget', () => {
  it('draws one box per class, with a legend', () => {
    renderWidget(spec, boxClasses);
    expect(screen.getAllByRole('button', { name: /^(Object|Collection|Set|Bag|Point)$/ })).toHaveLength(5);
    expect(screen.getByLabelText('Color legend').textContent).toContain('900');
  });

  it('shows the metrics with their names when hovering a box', () => {
    renderWidget(spec, boxClasses);
    fireEvent.mouseEnter(screen.getByLabelText('Set'));
    const card = screen.getByRole('tooltip');
    expect(card.textContent).toContain('Number Of Methods');
    expect(card.textContent).toContain('40');
    fireEvent.mouseLeave(screen.getByLabelText('Set'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('emits the row on `selected` and opens it in a new column on click and Enter', () => {
    const emit = renderWidget(spec, boxClasses);
    fireEvent.click(screen.getByLabelText('Set'));
    expect(emit).toHaveBeenCalledWith('selected', expect.objectContaining({ id: '3', name: 'Set' }));
    expect(screen.getByTestId('location').textContent).toContain('3');
    fireEvent.keyDown(screen.getByLabelText('Bag'), { key: 'Enter' });
    expect(emit).toHaveBeenLastCalledWith('selected', expect.objectContaining({ id: '4' }));
  });

  it('explains why there is nothing to draw', () => {
    renderWidget(spec, []);
    expect(screen.getByText(/No boxes/)).toBeTruthy();
  });
});

describe('boxes wiring', () => {
  it('feeds the clicked box to the widget bound to `@complexity`', async () => {
    const client = {
      query: () => ({ toPromise: () => Promise.resolve({ data: { classes: boxClasses } }) }),
    } as unknown as Client;
    render(
      <MemoryRouter>
        <Provider value={client}>
          <ViewRenderer spec={boxesExample} />
        </Provider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByLabelText('Set'));
    expect((await screen.findAllByText('900')).length).toBeGreaterThan(1);
  });
});

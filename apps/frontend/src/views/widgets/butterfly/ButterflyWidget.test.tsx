import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { butterflyExample, type ButterflyWidget as ButterflyWidgetSpec } from '@fluid/shared';
import { BADETITOU_THEME } from '../../../shared/theme';
import { resolveBinding } from '../../data';
import { WidgetThemeContext } from '../../plugin-api/widgetTheme';
import { ButterflyWidget } from './ButterflyWidget';
import { centerMethod, nextPutAll } from './butterflyFixture';

const spec = butterflyExample.widgets[0] as ButterflyWidgetSpec;
const data = resolveBinding(spec.data, { method: { method: centerMethod } });

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: ButterflyWidgetSpec, value: unknown = data, emit = vi.fn()) => {
  const view = render(
    <MemoryRouter initialEntries={['/d/Method']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ButterflyWidget widget={widget} data={value} resolve={() => undefined} emit={emit} />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, emit };
};

// jsdom has no layout: give the frame a width so the map renders.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 640, height: 400 }) as DOMRect;
});
afterEach(cleanup);

describe('ButterflyWidget', () => {
  it('draws the method between its callers and its callees, with the counters', () => {
    renderWidget(spec);
    expect(screen.getByText('2 incoming / 3 outgoing')).toBeTruthy();
    expect(screen.getByText('printStringLimitedTo:')).toBeTruthy();
    expect([...document.querySelectorAll('g[role="button"]')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'printString (Object) ×2',
      'displayString (Object)',
      'printOn: (Collection)',
      'writeStream (String)',
      'nextPutAll: (WriteStream) ×2',
    ]);
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(5);
  });

  it('emits the clicked neighbour and opens it in a new column', () => {
    const { emit } = renderWidget(spec);
    const callee = screen.getByRole('button', { name: /nextPutAll:/ });
    fireEvent.click(callee);
    expect(emit).toHaveBeenCalledWith('selected', nextPutAll);
    expect(screen.getByTestId('location').textContent).toMatch(/Method.*2(:|%3A)4/);
    expect(callee.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector(`[data-edge="center→out1:2:4"]`)?.getAttribute('class')).toMatch(/lit/);
  });

  it('opens a neighbour from the keyboard', () => {
    const { emit } = renderWidget(spec);
    fireEvent.keyDown(screen.getByRole('button', { name: /displayString/ }), { key: 'Enter' });
    expect(emit).toHaveBeenCalledWith('selected', expect.objectContaining({ name: 'displayString' }));
  });

  it('highlights the links of the hovered neighbour', () => {
    renderWidget(spec);
    fireEvent.mouseEnter(document.querySelector('[data-node="in1:2:2"]')!);
    expect(document.querySelector('[data-edge="in1:2:2→center"]')?.getAttribute('class')).toMatch(/lit/);
    expect(document.querySelector('[data-edge="in1:2:1→center"]')?.getAttribute('class')).not.toMatch(/lit/);
  });

  it('explains why nothing is drawn', () => {
    renderWidget(spec, null);
    expect(screen.getByText('No element: the query returned nothing to show.')).toBeTruthy();
    cleanup();
    renderWidget(spec, { id: '1', name: 'alone' });
    expect(screen.getByText(/No dependencies: alone has nothing/)).toBeTruthy();
  });

  it('follows the theme in light and dark mode', () => {
    const themed = (mode: 'light' | 'dark') => (
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode, tokens: BADETITOU_THEME[mode]! }}>
          <ButterflyWidget widget={spec} data={data} resolve={() => undefined} emit={() => {}} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>
    );
    const { container, rerender } = render(themed('light'));
    const frame = () => container.firstElementChild as HTMLElement;
    expect(frame().style.getPropertyValue('--bf-box')).toBe(BADETITOU_THEME.light!.surfaceCard);
    rerender(themed('dark'));
    expect(frame().style.getPropertyValue('--bf-box')).toBe(BADETITOU_THEME.dark!.surfaceCard);
  });
});

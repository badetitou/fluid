import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { characterEpisodesMatrixExample, classDependencyMatrixExample, type MatrixWidget as Spec } from '@fluid/shared';
import { BADETITOU_THEME } from '../../../shared/theme';
import { resolveBinding } from '../../data';
import { WidgetThemeContext } from '../../plugin-api/widgetTheme';
import { MatrixWidget } from './MatrixWidget';
import { dsmClasses, pilot, rickAndMortyCharacters } from './matrixFixture';

const dsm = classDependencyMatrixExample.widgets[0] as Spec;
const co = characterEpisodesMatrixExample.widgets[0] as Spec;
const dsmData = resolveBinding(dsm.data, { classes: { classes: dsmClasses } });
const coData = resolveBinding(co.data, { characters: rickAndMortyCharacters });

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: Spec, data: unknown, emit = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <MatrixWidget widget={widget} data={data} resolve={() => undefined} emit={emit} />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return emit;
};

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

describe('MatrixWidget', () => {
  it('draws the DSM: weighted cells, cycles marked, counters', () => {
    renderWidget(dsm, dsmData);
    expect(screen.getByRole('button', { name: 'Array → Bag: 2 (cycle)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Array → Collection: 1' })).toBeTruthy();
    expect(screen.getByText(/4 × 4 · 4 dependencies · 1 cycle/)).toBeTruthy();
  });

  it('emits { source, target, weight } when a cell is clicked', () => {
    const emit = renderWidget(dsm, dsmData);
    fireEvent.click(screen.getByRole('button', { name: 'Array → Bag: 2 (cycle)' }));
    expect(emit).toHaveBeenCalledWith('selected', { source: dsmClasses[0], target: dsmClasses[1], weight: 2 });
    expect(screen.getByRole('button', { name: 'Array → Bag: 2 (cycle)' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the element of a clicked label and emits its row', () => {
    const emit = renderWidget(dsm, dsmData);
    fireEvent.click(screen.getAllByRole('button', { name: 'Bag' })[0]);
    expect(emit).toHaveBeenCalledWith('selected', dsmClasses[1]);
    expect(screen.getByTestId('location').textContent).toMatch(/Class.*c(:|%3A)B/);
  });

  it('opens a target of a co-usage map with targetLinkTo, by keyboard', () => {
    const emit = renderWidget(co, coData);
    fireEvent.keyDown(screen.getByRole('button', { name: 'S01E01' }), { key: 'Enter' });
    expect(emit).toHaveBeenCalledWith('selected', pilot);
    expect(screen.getByTestId('location').textContent).toMatch(/Episode/);
  });

  it('shows the tooltip of a hovered cell', () => {
    renderWidget(dsm, dsmData);
    fireEvent.mouseMove(screen.getByRole('button', { name: 'Array → Bag: 2 (cycle)' }), { clientX: 10, clientY: 10 });
    expect(screen.getByRole('tooltip').textContent).toContain('Array → Bag : 2');
  });

  it('explains why nothing is drawn', () => {
    renderWidget(dsm, []);
    expect(screen.getByText('No elements: the query returned no rows.')).toBeTruthy();
  });

  it('follows the theme in light and dark mode', () => {
    const themed = (mode: 'light' | 'dark') => (
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode, tokens: BADETITOU_THEME[mode]! }}>
          <MatrixWidget widget={dsm} data={dsmData} resolve={() => undefined} emit={() => {}} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>
    );
    const { container, rerender } = render(themed('light'));
    const frame = () => container.firstElementChild as HTMLElement;
    expect(frame().style.getPropertyValue('--matrix-cell')).toBe(BADETITOU_THEME.light!.primary);
    rerender(themed('dark'));
    expect(frame().style.getPropertyValue('--matrix-cell')).toBe(BADETITOU_THEME.dark!.primary);
  });
});

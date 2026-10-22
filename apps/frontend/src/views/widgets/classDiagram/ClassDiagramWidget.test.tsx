import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { classDiagramExample, type ClassDiagramWidget as ClassDiagramWidgetSpec } from '@fluid/shared';
import { BADETITOU_THEME } from '../../../shared/theme';
import { resolveBinding } from '../../data';
import { WidgetThemeContext } from '../../plugin-api/widgetTheme';
import { ClassDiagramWidget } from './ClassDiagramWidget';
import { pharoClasses, setClass } from './classDiagramFixture';

const spec = classDiagramExample.widgets[0] as ClassDiagramWidgetSpec;
const data = resolveBinding(spec.data, { classes: { classes: pharoClasses } });

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: ClassDiagramWidgetSpec, rows: unknown = data, emit = vi.fn()) => {
  const view = render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ClassDiagramWidget widget={widget} data={rows} resolve={() => undefined} emit={emit} />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, emit };
};

const box = (name: string) => screen.getByRole('button', { name }).closest('[data-class]') as HTMLElement;

beforeAll(() => {
  // jsdom has no layout: antd's select list measures itself.
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

describe('ClassDiagramWidget', () => {
  it('draws the example two levels deep: UML boxes, superclasses collected from the nesting', () => {
    renderWidget(spec);
    expect(screen.getByText('4 of 8 classes')).toBeTruthy();
    const collection = box('Collection');
    expect(within(collection).getByText('«abstract»')).toBeTruthy();
    expect(within(collection).getByText('Collections-Abstract')).toBeTruthy();
    expect(within(collection).getByRole('button', { name: /Unfold the subclasses of Collection/ }).textContent).toContain(
      '3 classes hidden',
    );
    expect(within(box('Object')).getByRole('button', { name: /Fold the subclasses/ }).textContent).toContain('2 subclasses');
    expect(screen.queryByRole('button', { name: 'Set' })).toBeNull();
    // one triangle under each unfolded superclass: ProtoObject and Object
    const arrows = document.querySelectorAll('[data-part="connectors"] path')[1].getAttribute('d');
    expect(arrows?.match(/Z/g)).toHaveLength(2);
  });

  it('unfolds and folds a branch, then everything', () => {
    renderWidget(spec);
    fireEvent.click(screen.getByRole('button', { name: /Unfold the subclasses of Collection/ }));
    expect(screen.getByText('5 of 8 classes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Unfold all/ }));
    expect(screen.getByText('8 of 8 classes')).toBeTruthy();
    const bag = box('Bag');
    expect(within(bag).getByRole('list', { name: 'Attributes' }).textContent).toBe('contents');
    expect(within(bag).getByText('+1 more')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Fold all/ }));
    expect(screen.getByText('1 of 8 classes')).toBeTruthy();
  });

  it('emits the clicked class and opens it in a new column', () => {
    const { emit } = renderWidget({ ...spec, expandDepth: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(emit).toHaveBeenCalledWith('selected', setClass);
    expect(screen.getByTestId('location').textContent).toMatch(/Class.*1(:|%3A)10/);
    expect(box('Set').className).toMatch(/selected/);
    expect(screen.getByRole('button', { name: 'Set' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('finds a folded class: unfolds its superclasses and selects it, without leaving the column', async () => {
    const { emit } = renderWidget(spec);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Find a class' }));
    fireEvent.click(await screen.findByTitle('Set (Collections-Unordered)'));
    expect(screen.getByText('7 of 8 classes')).toBeTruthy();
    expect(emit).toHaveBeenCalledWith('selected', setClass);
    expect(box('Set').className).toMatch(/selected/);
    expect(screen.getByTestId('location').textContent).toBe('/d/Class');
  });

  it('names the other superclasses of a class with several', () => {
    const rows = [
      { id: 'C', name: 'C', supers: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }] },
      { id: 'D', name: 'D', supers: [{ id: 'C' }] },
    ];
    renderWidget({ ...spec, superField: 'supers' }, rows);
    expect(within(box('C')).getByText('extends B')).toBeTruthy();
  });

  it('explains why nothing is drawn, or why no inheritance is', () => {
    renderWidget(spec, []);
    expect(screen.getByText('No classes: the query returned no rows.')).toBeTruthy();
    cleanup();
    renderWidget({ ...spec, superField: 'superclass' });
    expect(screen.getByText('No inheritance: no class has a superclass in "superclass".')).toBeTruthy();
  });

  it('follows the theme in light and dark mode', () => {
    const themed = (mode: 'light' | 'dark') => (
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode, tokens: BADETITOU_THEME[mode]! }}>
          <ClassDiagramWidget widget={spec} data={data} resolve={() => undefined} emit={() => {}} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>
    );
    const { container, rerender } = render(themed('light'));
    const frame = () => container.firstElementChild as HTMLElement;
    expect(frame().style.getPropertyValue('--uml-box')).toBe(BADETITOU_THEME.light!.surfaceCard);
    rerender(themed('dark'));
    expect(frame().style.getPropertyValue('--uml-box')).toBe(BADETITOU_THEME.dark!.surfaceCard);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { blueprintExample, type BlueprintWidget as BlueprintWidgetSpec } from '@fluid/shared';
import { BADETITOU_THEME } from '../../../shared/theme';
import { resolveBinding } from '../../data';
import { WidgetThemeContext } from '../../plugin-api/widgetTheme';
import { BlueprintWidget } from './BlueprintWidget';
import { growAtLast, orderedCollection } from './blueprintFixture';

const spec = blueprintExample.widgets[0] as BlueprintWidgetSpec;
const data = resolveBinding(spec.data, { class: { class: orderedCollection } });

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (
  widget: BlueprintWidgetSpec = spec,
  value: unknown = data,
  emit = vi.fn(),
) => {
  const view = render(
    <MemoryRouter initialEntries={['/d/Class']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <BlueprintWidget widget={widget} data={value} resolve={() => undefined} emit={emit} />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, emit };
};

const box = (name: RegExp) => screen.getByRole('button', { name });
afterEach(cleanup);

describe('BlueprintWidget', () => {
  it('draws the layers, a box per method and attribute, the arrows and the legend', () => {
    renderWidget();
    for (const title of [
      'Initialization',
      'External interface',
      'Internal implementation',
      'Accessors',
      'Attributes',
    ])
      expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(box(/^growAtLast \(method, 12 lines\)/)).toBeTruthy();
    expect(box(/^isEmpty \(abstract method/)).toBeTruthy();
    expect(box(/^array \(attribute\)/)).toBeTruthy();
    expect(document.querySelectorAll('[data-part="edges"] path[data-kind]')).toHaveLength(12);
    const legend = screen.getByRole('list', { name: 'Legend' }).textContent;
    expect(legend).toContain('Overriding');
    expect(legend).toContain('9 methods, 3 attributes');
  });

  it('highlights the calls and accesses of the hovered method, fading the rest', () => {
    renderWidget();
    fireEvent.mouseEnter(box(/^makeRoomAtLast/));
    expect(box(/^growAtLast/).getAttribute('class')).not.toMatch(/dim/);
    expect(box(/^addLast:/).getAttribute('class')).not.toMatch(/dim/);
    expect(box(/^initialize/).getAttribute('class')).toMatch(/dim/);
    const hot = document.querySelector('path[data-from="m:2:5"][data-to="m:2:7"]');
    expect(hot?.getAttribute('class')).toMatch(/hot/);
    fireEvent.mouseLeave(box(/^makeRoomAtLast/));
    expect(box(/^initialize/).getAttribute('class')).not.toMatch(/dim/);
  });

  it('emits the clicked method and opens it in a new column', () => {
    const { emit } = renderWidget();
    fireEvent.click(box(/^growAtLast/));
    expect(emit).toHaveBeenCalledWith('selected', growAtLast);
    expect(screen.getByTestId('location').textContent).toMatch(/Method.*2(:|%3A)7/);
    expect(box(/^growAtLast/).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens an attribute from the keyboard, with its own link', () => {
    const { emit } = renderWidget();
    fireEvent.keyDown(box(/^array \(attribute\)/), { key: 'Enter' });
    expect(emit).toHaveBeenCalledWith('selected', { id: '3:3', name: 'array' });
    expect(screen.getByTestId('location').textContent).toMatch(/Attribute.*3(:|%3A)3/);
  });

  it('explains why there is nothing to draw', () => {
    renderWidget(spec, { id: '1:1', name: 'Empty' });
    expect(screen.getByText(/No methods: "methods" is empty or not selected/)).toBeTruthy();
  });

  it('takes its colors from the theme, light and dark', () => {
    const themed = (mode: 'light' | 'dark') => (
      <MemoryRouter>
        <WidgetThemeContext.Provider value={{ mode, tokens: BADETITOU_THEME[mode]! }}>
          <BlueprintWidget widget={spec} data={data} resolve={() => undefined} emit={vi.fn()} />
        </WidgetThemeContext.Provider>
      </MemoryRouter>
    );
    const { container, rerender } = render(themed('light'));
    const frame = () => container.firstElementChild as HTMLElement;
    expect(frame().style.getPropertyValue('--bp-box')).toBe(BADETITOU_THEME.light!.surfaceCard);
    rerender(themed('dark'));
    expect(frame().style.getPropertyValue('--bp-box')).toBe(BADETITOU_THEME.dark!.surfaceCard);
    expect(frame().style.getPropertyValue('--bp-highlight')).toBe(BADETITOU_THEME.dark!.primary);
  });
});

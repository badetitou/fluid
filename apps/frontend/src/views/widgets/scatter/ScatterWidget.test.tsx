import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { countryScatterExample, type ScatterWidget as ScatterWidgetSpec } from '@fluid/shared';
import { asRows, resolveBinding } from '../../data';
import { ScatterWidget } from './ScatterWidget';

const spec = countryScatterExample.widgets[0] as ScatterWidgetSpec;
const countries = {
  countries: [
    { code: 'FR', name: 'France', capital: 'Paris', continent: { name: 'Europe' }, states: [{ code: 'A' }, { code: 'B' }], languages: [{ code: 'fr' }] },
    { code: 'BR', name: 'Brazil', capital: 'Brasília', continent: { name: 'South America' }, states: [], languages: [{ code: 'pt' }] },
  ],
};
const rows = asRows(resolveBinding(spec.data, { countries }));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: ScatterWidgetSpec, data = rows) =>
  render(
    <MemoryRouter initialEntries={['/d/Country']}>
      <Routes>
        <Route path="*" element={<><ScatterWidget widget={widget} rows={data} /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

// jsdom has no layout: give the frame a width so the plot renders.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 500, height: 300 }) as DOMRect;
});
afterEach(cleanup);

describe('ScatterWidget', () => {
  it('draws one dot per item, with axis titles and a legend', () => {
    renderWidget(spec);
    expect(screen.getAllByRole('link').map((dot) => dot.getAttribute('aria-label'))).toEqual(['France', 'Brazil']);
    expect(screen.getByText('States')).toBeTruthy();
    expect(screen.getByText('South America')).toBeTruthy();
  });

  it('shows the label and the configured values when hovering a dot', () => {
    renderWidget(spec);
    fireEvent.mouseEnter(screen.getByLabelText('France'));
    const card = screen.getByRole('tooltip');
    expect(card.textContent).toContain('France');
    expect(card.textContent).toContain('Paris');
    fireEvent.mouseLeave(screen.getByLabelText('France'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows no card when the tooltip is turned off', () => {
    renderWidget({ ...spec, tooltip: false });
    fireEvent.mouseEnter(screen.getByLabelText('France'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens the item in a new column when a dot is clicked', () => {
    renderWidget(spec);
    fireEvent.click(screen.getByLabelText('Brazil'));
    expect(screen.getByTestId('location').textContent).toContain('BR');
  });

  it('draws plain dots without linkTo, and an empty state without data', () => {
    renderWidget({ ...spec, linkTo: undefined });
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    cleanup();
    const { container } = renderWidget(spec, []);
    expect(container.querySelector('.ant-empty-description')?.textContent).toBe('No data');
  });
});

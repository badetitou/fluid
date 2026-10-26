import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { characterFlowSankeyExample, type SankeyWidget as SankeyWidgetSpec } from '@fluid/shared';
import { SankeyWidget } from './SankeyWidget';
import { rickAndMortyCharacters } from './sankeyFixture';

const spec = characterFlowSankeyExample.widgets[0] as SankeyWidgetSpec;

const renderWidget = (widget: SankeyWidgetSpec, data: unknown = rickAndMortyCharacters) => {
  const emit = vi.fn();
  render(<SankeyWidget widget={widget} data={data} resolve={() => undefined} emit={emit} />);
  return emit;
};

// jsdom has no layout: give the frame a width so the diagram renders.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 400 }) as DOMRect;
});
afterEach(cleanup);

describe('SankeyWidget', () => {
  it('draws the groups as nodes and the flows as ribbons', () => {
    renderWidget(spec);
    for (const label of ['Human', 'Alien', 'Alive', 'Dead', 'unknown']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Human → Alive: 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alien → unknown: 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Human: 6' })).toBeTruthy();
  });

  it('shows "A → B: v" when hovering a ribbon', () => {
    renderWidget(spec);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Human → Dead: 1' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Human → Dead: 1');
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Human → Dead: 1' }));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('emits the clicked node with its rows, and the ribbon chosen with Enter', () => {
    const emit = renderWidget(spec);
    fireEvent.click(screen.getByRole('button', { name: 'Dead: 1' }));
    expect(emit).toHaveBeenLastCalledWith('selected', { group: 'Dead', rows: [rickAndMortyCharacters[2]] });
    expect(screen.getByRole('button', { name: 'Dead: 1' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Alien → Alive: 1' }), { key: 'Enter' });
    expect(emit).toHaveBeenLastCalledWith('selected', {
      source: 'Alien',
      target: 'Alive',
      value: 1,
      rows: [rickAndMortyCharacters[3]],
    });
  });

  it('dashes the flows closing a cycle and says so', () => {
    const rows = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    renderWidget({ ...spec, sourceField: 'from', targetField: 'to', nodeOrder: undefined }, rows);
    expect(screen.getByRole('button', { name: 'B → A: 1 (back, closes a cycle)' })).toBeTruthy();
    expect(screen.getByText(/1 flow goes back/)).toBeTruthy();
  });

  it('explains why there is no diagram', () => {
    renderWidget(spec, []);
    expect(document.querySelector('.ant-empty-description')?.textContent).toBe('No data');
    cleanup();
    renderWidget(spec, [{ species: 'Human' }]);
    expect(screen.getByText(/no row has both "species" and "status"/)).toBeTruthy();
  });
});

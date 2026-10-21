import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AccordionWidget as AccordionWidgetSpec, DataBinding, Widget } from '@fluid/shared';
import { AccordionWidget } from './AccordionWidget';

const methods = [
  { id: 'm1', selector: 'printOn:', protocol: 'printing', sourceCode: 'printOn: aStream' },
  { id: 'm2', selector: 'initialize', protocol: 'init', sourceCode: 'initialize super initialize' },
];

const spec: AccordionWidgetSpec = {
  id: 'methods',
  type: 'accordion',
  data: { query: 'class', path: 'methods' },
  labelField: 'selector',
  summary: [{ key: 'protocol' }],
  widgets: [{ id: 'src', type: 'richtext', data: { query: '$item' }, field: 'sourceCode' }],
};

// Stands in for the catalog: shows what the nested widget resolves.
function Nested({ widget, resolve }: { widget: Widget; resolve: (b: DataBinding) => unknown }) {
  const value = resolve({ ...widget.data, path: 'sourceCode' });
  return <pre>{String(value)}</pre>;
}

const renderWidget = (widget: AccordionWidgetSpec, data: unknown = methods) =>
  render(
    <MemoryRouter>
      <AccordionWidget widget={widget} data={data} resolve={() => undefined} Nested={Nested} />
    </MemoryRouter>,
  );

// The panel body measures its width, which jsdom does not implement.
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

describe('AccordionWidget', () => {
  it('shows one folded panel per element, with its label and summary', () => {
    renderWidget(spec);
    expect(screen.getByText('printOn:')).toBeTruthy();
    expect(screen.getByText('printing')).toBeTruthy();
    expect(screen.queryByText('printOn: aStream')).toBeNull();
  });

  it('renders the nested widgets on the unfolded element only', () => {
    renderWidget(spec);
    fireEvent.click(screen.getByText('initialize'));
    expect(screen.getByText('initialize super initialize')).toBeTruthy();
    expect(screen.queryByText('printOn: aStream')).toBeNull();
  });

  it('unfolds the first panel on request', () => {
    renderWidget({ ...spec, expanded: 'first' });
    expect(screen.getByText('printOn: aStream')).toBeTruthy();
  });

  it('pages long collections', () => {
    renderWidget({ ...spec, pageSize: 1 });
    expect(screen.queryByText('initialize')).toBeNull();
    fireEvent.click(screen.getByTitle('2'));
    expect(screen.getByText('initialize')).toBeTruthy();
  });

  it('says when the collection is empty', () => {
    renderWidget(spec, []);
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
  });
});

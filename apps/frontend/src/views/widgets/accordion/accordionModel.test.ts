import { describe, expect, it } from 'vitest';
import { buildPanels, initialOpenKeys, itemResolver, nestedSpan, pageOf } from './accordionModel';

const methods = [
  { id: 'm1', selector: 'printOn:', sourceCode: 'printOn: aStream', critiques: [{ line: 1 }] },
  { id: 'm2', selector: 'initialize', sourceCode: 'initialize' },
  { id: 'm3', name: 'size' },
];

describe('buildPanels', () => {
  it('keys panels by id and labels them by labelField', () => {
    const panels = buildPanels(methods, 'id', 'selector');
    expect(panels.map((p) => [p.key, p.label])).toEqual([
      ['m1', 'printOn:'],
      ['m2', 'initialize'],
      ['m3', 'size'],
    ]);
  });

  it('falls back to positions for missing or duplicate keys', () => {
    expect(buildPanels([{ name: 'a' }, { id: 'x' }, { id: 'x' }]).map((p) => p.key)).toEqual(['#0', 'x', 'x#2']);
  });

  it('accepts a single object and nothing', () => {
    expect(buildPanels({ id: 1, name: 'one' })).toHaveLength(1);
    expect(buildPanels(undefined)).toEqual([]);
  });
});

describe('initialOpenKeys', () => {
  const panels = buildPanels(methods);
  it('folds everything by default', () => expect(initialOpenKeys(panels)).toEqual([]));
  it('unfolds the first panel', () => expect(initialOpenKeys(panels, 'first')).toEqual(['m1']));
  it('unfolds all panels', () => expect(initialOpenKeys(panels, 'all')).toEqual(['m1', 'm2', 'm3']));
});

describe('pageOf', () => {
  it('slices a 1-based page', () => {
    expect(pageOf(buildPanels(methods), 2, 2).map((p) => p.key)).toEqual(['m3']);
  });
});

describe('nestedSpan', () => {
  it('keeps the span when the panel is wide enough', () => expect(nestedSpan(8, 1200)).toBe(8));
  it('defaults to the whole row', () => expect(nestedSpan(undefined, 1200)).toBe(24));
  it('widens a span narrower than the minimum width', () => expect(nestedSpan(4, 720)).toBe(8));
  it('stacks widgets in a narrow panel', () => expect(nestedSpan(8, 400)).toBe(24));
});

describe('itemResolver', () => {
  const parent = (b: { query: string }) => `view:${b.query}`;

  it('reads $item bindings in the panel element', () => {
    const resolve = itemResolver(methods[0], parent);
    expect(resolve({ query: '$item', path: 'sourceCode' })).toBe('printOn: aStream');
    expect(resolve({ query: '$item', path: 'critiques', transform: { limit: 1 } })).toEqual([{ line: 1 }]);
  });

  it('sends other bindings to the enclosing resolver', () => {
    expect(itemResolver(methods[0], parent)({ query: 'class' })).toBe('view:class');
  });

  it('shadows the element of an enclosing accordion', () => {
    const outer = itemResolver({ name: 'outer' }, parent);
    expect(itemResolver({ name: 'inner' }, outer)({ query: '$item', path: 'name' })).toBe('inner');
  });
});

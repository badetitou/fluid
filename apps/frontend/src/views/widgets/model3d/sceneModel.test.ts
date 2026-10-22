import { describe, expect, it } from 'vitest';
import { boundsOf, buildElements, categoryColors, DEFAULT_HIDDEN_TYPES, highlightIds } from './sceneModel';
import { opening, port, terminal, wall } from './ifcFixtures';

describe('buildElements', () => {
  it('keeps the rows that have geometry, labelled and categorised by IFC class', () => {
    const elements = buildElements([wall, port, terminal]);
    expect(elements.map((e) => [e.key, e.label, e.category])).toEqual([
      ['inst:wall', 'Wall A', 'IfcWallStandardCase'],
      ['inst:terminal', 'Sink', 'IfcFlowTerminal'],
    ]);
  });

  it('reads a single object as one element', () => {
    expect(buildElements(wall)).toHaveLength(1);
    expect(buildElements(null)).toEqual([]);
  });

  it('hides the given IFC classes', () => {
    expect(buildElements([wall, opening], { hiddenTypes: DEFAULT_HIDDEN_TYPES }).map((e) => e.id)).toEqual(['inst:wall']);
  });

  it('uses the configured fields', () => {
    const [element] = buildElements([{ ...wall, tag: 'W-1', storey: { name: 'Ground' } }], { labelField: 'tag', colorField: 'storey.name' });
    expect([element.label, element.category]).toEqual(['W-1', 'Ground']);
  });
});

describe('highlightIds', () => {
  it('takes the ids of objects, lists, or ids as such', () => {
    expect([...highlightIds(wall)]).toEqual(['inst:wall']);
    expect([...highlightIds([wall, { id: 7 }, 'inst:x'])]).toEqual(['inst:wall', '7', 'inst:x']);
    expect([...highlightIds({ code: 'A' }, 'code')]).toEqual(['A']);
    expect(highlightIds(undefined).size).toBe(0);
  });
});

describe('categoryColors', () => {
  it('gives each category the next color of the palette, cycling', () => {
    const elements = buildElements([wall, terminal, { ...wall, _id: 'w2' }]);
    expect([...categoryColors(elements, ['red'])]).toEqual([['IfcWallStandardCase', 'red'], ['IfcFlowTerminal', 'red']]);
    expect(categoryColors(elements, ['red', 'blue']).get('IfcFlowTerminal')).toBe('blue');
  });
});

describe('boundsOf', () => {
  it('encloses every element, or is null for none', () => {
    expect(boundsOf(buildElements([wall, terminal]))).toEqual({ min: [0, 0, 0], max: [14, 6, 5] });
    expect(boundsOf([])).toBeNull();
  });
});

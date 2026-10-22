import { describe, expect, it } from 'vitest';
import { buildClassForest } from './classDiagramModel';
import { ARROW, BOX, boxHeight, layoutForest, shownMembers, type BoxContent, type PlacedClass } from './classLayout';

const content: BoxContent = { maxMembers: 3, attributes: true, methods: true, group: true };
const sub = (id: string, parent?: string) => ({ id, name: id, superclass: parent });
const forestOf = (rows: object[]) => buildClassForest(rows, { superField: 'superclass' });
const fixed = () => 60;

const byKey = (boxes: PlacedClass[]) => new Map(boxes.map((b) => [b.key, b]));
const centre = (b: PlacedClass) => b.x + BOX.width / 2;
const overlap = (a: PlacedClass, b: PlacedClass) =>
  a.x < b.x + BOX.width && b.x < a.x + BOX.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('boxHeight', () => {
  it('grows with the header lines, the members shown and the fold bar', () => {
    const forest = buildClassForest(
      [
        { id: 'A', attributes: ['a', 'b', 'c', 'd', 'e'], methods: [] },
        { id: 'B', superclass: 'A', isAbstract: true, pkg: 'p', attributes: [], methods: [] },
      ],
      { superField: 'superclass', attributesField: 'attributes', methodsField: 'methods', abstractField: 'isAbstract', groupField: 'pkg' },
    );
    const a = forest.classes.get('A')!;
    const b = forest.classes.get('B')!;
    expect(shownMembers(5, 3)).toBe(4);
    expect(shownMembers(2, 3)).toBe(2);
    // borders + name line + paddings, attributes (3 + "more"), empty methods, fold bar
    expect(boxHeight(a, content)).toBe(2 + BOX.line + 8 + (4 * BOX.line + 8 + 1) + (BOX.empty + 1) + BOX.toggle);
    // «abstract» and package lines, two empty compartments, no fold bar
    expect(boxHeight(b, content)).toBe(2 + 3 * BOX.line + 8 + 2 * (BOX.empty + 1));
    expect(boxHeight(a, { ...content, maxMembers: 0 })).toBe(2 + BOX.line + 8 + BOX.toggle);
  });
});

describe('layoutForest', () => {
  it('puts the superclass above its subclasses, centred over them, with a triangle under it', () => {
    const forest = forestOf([sub('A'), sub('B', 'A'), sub('C', 'A')]);
    const layout = layoutForest(forest, new Set(['A']), fixed);
    const boxes = byKey(layout.boxes);
    const [a, b, c] = ['A', 'B', 'C'].map((k) => boxes.get(k)!);
    expect(b.y).toBeGreaterThan(a.y + a.height);
    expect(b.y).toBe(c.y);
    expect(centre(a)).toBe((centre(b) + centre(c)) / 2);
    expect(layout.arrows).toEqual([{ x: centre(a), y: a.y + a.height }]);
    // the stem leaves the triangle's base, drops reach the subclasses' tops
    expect(layout.lines).toContainEqual({ x1: centre(a), y1: a.y + a.height + ARROW, x2: centre(a), y2: expect.any(Number) });
    expect(layout.lines.some((l) => l.x1 === centre(b) && l.y2 === b.y)).toBe(true);
  });

  it('hides the subclasses of a folded class', () => {
    const forest = forestOf([sub('A'), sub('B', 'A'), sub('C', 'B')]);
    expect(layoutForest(forest, new Set(), fixed).boxes.map((b) => b.key)).toEqual(['A']);
    expect(layoutForest(forest, new Set(['A']), fixed).boxes.map((b) => b.key)).toEqual(['A', 'B']);
    expect(layoutForest(forest, new Set(['A', 'B']), fixed).boxes).toHaveLength(3);
    expect(layoutForest(forest, new Set(['A']), fixed).arrows).toHaveLength(1);
  });

  it('stacks many subclasses in columns hanging from spines, without overlap', () => {
    const kids = Array.from({ length: 9 }, (_, i) => sub(`K${i}`, 'A'));
    const forest = forestOf([sub('A'), ...kids]);
    const layout = layoutForest(forest, new Set(['A']), fixed);
    const boxes = layout.boxes.filter((b) => b.key !== 'A');
    expect(new Set(boxes.map((b) => b.x)).size).toBe(3);
    expect(new Set(boxes.map((b) => b.y)).size).toBe(3);
    for (const [i, x] of boxes.entries()) for (const y of boxes.slice(i + 1)) expect(overlap(x, y)).toBe(false);
    // each stacked class has a tick from its spine to its left side
    for (const box of boxes) expect(layout.lines.some((l) => l.y1 === l.y2 && l.x2 === box.x)).toBe(true);
  });

  it('lays several roots side by side, the whole diagram fitting its size', () => {
    const forest = forestOf([sub('A'), sub('B', 'A'), sub('Z')]);
    const layout = layoutForest(forest, new Set(['A']), fixed);
    const boxes = byKey(layout.boxes);
    expect(boxes.get('Z')!.x).toBeGreaterThan(boxes.get('B')!.x + BOX.width);
    expect(boxes.get('Z')!.y).toBe(boxes.get('A')!.y);
    for (const b of layout.boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + BOX.width).toBeLessThanOrEqual(layout.width);
      expect(b.y + b.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it('keeps a wide superclass over a single narrow subtree inside the diagram', () => {
    const forest = forestOf([sub('A'), sub('B', 'A')]);
    const boxes = byKey(layoutForest(forest, new Set(['A']), fixed).boxes);
    expect(centre(boxes.get('A')!)).toBe(centre(boxes.get('B')!));
  });
});

import { describe, expect, it } from 'vitest';
import { BADETITOU_THEME } from '../../../shared/theme';
import {
  ancestorsOf,
  buildClassForest,
  emptyReason,
  expandableKeys,
  hiddenBelow,
  initialExpanded,
  memberLabels,
  missingSuperReason,
  type ClassForest,
} from './classDiagramModel';
import { accentColors, classDiagramPalette, paletteVariables } from './classDiagramStyle';

const SUPER = 'superInheritances.superclass';

/** A class as the Pharo API returns it: superclasses through Inheritance objects. */
const cls = (id: string, ...supers: object[]) => ({ id, name: id, superInheritances: supers.map((superclass) => ({ superclass })) });

const children = (forest: ClassForest, key: string) => forest.classes.get(key)?.children;

describe('buildClassForest', () => {
  it('follows superclasses through association objects at any depth, adding them as classes', () => {
    const object = cls('Object', cls('ProtoObject'));
    const rows = [cls('Set', cls('HashedCollection', cls('Collection', object))), cls('Bag', cls('HashedCollection'))];
    const forest = buildClassForest(rows, { superField: SUPER });
    expect(forest.roots).toEqual(['ProtoObject']);
    expect(children(forest, 'ProtoObject')).toEqual(['Object']);
    expect(children(forest, 'Collection')).toEqual(['HashedCollection']);
    expect(children(forest, 'HashedCollection')).toEqual(['Bag', 'Set']);
    expect(forest.classes.get('Set')?.depth).toBe(4);
    expect(forest.classes.get('ProtoObject')?.descendants).toBe(5);
    expect(forest.classes.get('HashedCollection')?.descendants).toBe(2);
  });

  it('reads superclasses given as ids or as a single object', () => {
    const byId = buildClassForest([{ id: 1, name: 'A' }, { id: 2, name: 'B', parent: 1 }], { superField: 'parent' });
    expect(children(byId, '1')).toEqual(['2']);
    const byObject = buildClassForest([{ id: 'B', superclass: { id: 'A', name: 'Alpha' } }], { superField: 'superclass' });
    expect(byObject.roots).toEqual(['A']);
    expect(byObject.classes.get('A')?.label).toBe('Alpha');
  });

  it('places a class under its first superclass and names the others', () => {
    const forest = buildClassForest(
      [cls('C', { id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }), cls('A'), cls('B')],
      { superField: SUPER },
    );
    expect(forest.classes.get('C')?.parent).toBe('A');
    expect(forest.classes.get('C')?.others).toEqual(['B']);
    expect(children(forest, 'B')).toEqual([]);
  });

  it('survives cycles: the link closing one is not drawn, only named', () => {
    const rows = [
      { id: 'A', superclass: 'B' },
      { id: 'B', superclass: 'C' },
      { id: 'C', superclass: 'A' },
      { id: 'D', superclass: 'D' },
    ];
    const forest = buildClassForest(rows, { superField: 'superclass' });
    expect(forest.roots.sort()).toEqual(['C', 'D']);
    expect(forest.classes.get('C')?.others).toEqual(['A']);
    expect(forest.classes.get('A')?.depth).toBe(2);
    expect(forest.classes.get('D')?.others).toEqual([]);
  });

  it('tolerates incoherent data', () => {
    const rows = [null, 3, 'x', { name: 'no id' }, { id: 'A', superclass: [{}, null, { name: 'no id' }] }];
    const forest = buildClassForest(rows, { superField: 'superclass' });
    expect([...forest.classes.keys()]).toEqual(['A']);
    expect(forest.roots).toEqual(['A']);
  });

  it('reads members, abstractness and package', () => {
    const row = {
      id: 'A',
      kind: { abstract: true },
      pkg: { name: 'Kernel' },
      attributes: [{ id: 1, name: 'size' }, 'tally'],
      methods: [{ id: 2, selector: 'add:' }],
    };
    const forest = buildClassForest([row], {
      superField: 'superclass',
      attributesField: 'attributes',
      methodsField: 'methods',
      memberLabelField: 'selector',
      abstractField: 'kind.abstract',
      groupField: 'pkg.name',
    });
    const a = forest.classes.get('A');
    expect(a).toMatchObject({ abstract: true, group: 'Kernel', attributes: ['size', 'tally'], methods: ['add:'] });
    expect(forest.groups).toEqual(['Kernel']);
    expect(memberLabels(row, undefined)).toEqual([]);
  });

  it('puts the largest hierarchy first among several roots', () => {
    const forest = buildClassForest([cls('Lonely'), cls('B', cls('Big')), cls('C', cls('Big'))], { superField: SUPER });
    expect(forest.roots).toEqual(['Big', 'Lonely']);
  });

  it('explains an empty diagram', () => {
    const none = buildClassForest([], { superField: SUPER });
    expect(emptyReason([], none)).toMatch(/no rows/);
    const noIds = buildClassForest([{ name: 'A' }], { superField: SUPER });
    expect(emptyReason([{ name: 'A' }], noIds, 'key')).toMatch(/"key"/);
    const flat = buildClassForest([cls('A'), cls('B')], { superField: SUPER });
    expect(missingSuperReason(flat, SUPER)).toMatch(/No inheritance/);
    expect(missingSuperReason(buildClassForest([cls('B', cls('A'))], { superField: SUPER }), SUPER)).toBeNull();
  });
});

describe('folding', () => {
  const forest = buildClassForest([cls('D', cls('C', cls('B', cls('A')))), cls('E', cls('A'))], { superField: SUPER });

  it('unfolds the first levels at first', () => {
    expect([...initialExpanded(forest, 2)].sort()).toEqual(['A', 'B']);
    expect(initialExpanded(forest, 0).size).toBe(0);
    expect([...expandableKeys(forest)].sort()).toEqual(['A', 'B', 'C']);
  });

  it('counts what a folded class hides, and finds the way up to a class', () => {
    const a = forest.classes.get('A')!;
    expect(hiddenBelow(a, new Set())).toBe(4);
    expect(hiddenBelow(a, new Set(['A']))).toBe(0);
    expect(ancestorsOf(forest, 'D')).toEqual(['C', 'B', 'A']);
    expect(ancestorsOf(forest, 'missing')).toEqual([]);
  });
});

describe('palette', () => {
  it('derives the colors from the theme, overridable per widget', () => {
    const tokens = BADETITOU_THEME.light!;
    const theme = { ...tokens, mode: 'light' as const, series: ['#111', '#222'], vars: { lineColor: '#abc' } };
    const palette = classDiagramPalette(theme);
    expect(palette.line).toBe('#abc');
    expect(palette.selection).toBe(tokens.primary);
    expect(paletteVariables(palette)).toMatchObject({ '--uml-line': '#abc' });
    const forest = buildClassForest(
      [
        { id: 'A', pkg: 'x' },
        { id: 'B', pkg: 'y', superclass: 'A' },
        { id: 'C', superclass: 'A' },
      ],
      { superField: 'superclass', groupField: 'pkg' },
    );
    const colors = accentColors(forest, palette);
    expect([colors.get('A'), colors.get('B'), colors.get('C')]).toEqual(['#111', '#222', palette.accent]);
  });
});

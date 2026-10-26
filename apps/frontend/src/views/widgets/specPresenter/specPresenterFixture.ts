import type { SpecFluidNode } from '@fluid/shared';

// A Moose class's inspector tab as Spec-Fluid would serve it: a composite of a
// table, a tree, a Roassal canvas, source text and a presenter fluid cannot draw.

export const methodsTable: SpecFluidNode = {
  kind: 'table',
  columns: [{ title: 'Method' }, { title: 'Lines' }, { title: '' }],
  rows: [
    { cells: [{ text: 'printOn:', ref: { id: 'm1', type: 'Method' } }, { text: '12' }, { text: 'public' }] },
    { cells: [{ text: 'add:', ref: { id: 'm2', type: 'Method' } }, { text: '9' }, { text: 'public' }] },
    { cells: [{ text: 'size' }, { text: '100' }, { text: 'private' }], ref: { id: 'm3', type: 'Method' } },
  ],
  truncated: true,
};

export const packagesTree: SpecFluidNode = {
  kind: 'tree',
  columns: [{ title: 'Package' }],
  roots: [
    {
      cells: [{ text: 'Collections', ref: { id: 'p1', type: 'Package' } }],
      children: [{ cells: [{ text: 'Collections-Abstract', ref: { id: 'p2', type: 'Package' } }], hasMore: true }],
    },
  ],
};

export const hierarchySvg: SpecFluidNode = {
  kind: 'svg',
  svg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">' +
    '<script>alert(1)</script>' +
    '<g data-fluid-ref="c1" data-fluid-type="Class" onclick="alert(2)"><rect x="0" y="0" width="80" height="30"/><text x="4" y="20">Collection</text></g>' +
    '<rect x="100" y="0" width="80" height="30"/>' +
    '</svg>',
  refs: [{ ref: { id: 'c2', type: 'Class' }, x: 100, y: 0, width: 80, height: 30 }],
};

export const fameTab: SpecFluidNode = {
  kind: 'composite',
  direction: 'column',
  children: [
    { kind: 'composite', direction: 'row', children: [methodsTable, packagesTree] },
    hierarchySvg,
    { kind: 'text', text: 'printOn: aStream\n\taStream << self name', language: 'smalltalk' },
    { kind: 'unsupported', presenter: 'SpRoassalInspectorPresenter', message: 'animated canvas' },
  ],
};

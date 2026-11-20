import type { ViewNode } from '@fluid/shared';

// A Moose class's view as an Open Views provider (here Pharo) would serve it: a
// composite of a columned list, a tree, a Roassal canvas, source text and a
// view the provider cannot export.

export const methodsTable: ViewNode = {
  kind: 'columnedList',
  columns: [{ title: 'Method' }, { title: 'Lines' }, { title: '' }],
  items: [
    { cells: [{ text: 'printOn:', ref: { id: 'm1', type: 'Method' } }, { text: '12' }, { text: 'public' }] },
    { cells: [{ text: 'add:', ref: { id: 'm2', type: 'Method' } }, { text: '9' }, { text: 'public' }] },
    { cells: [{ text: 'size' }, { text: '100' }, { text: 'private' }], ref: { id: 'm3', type: 'Method' } },
  ],
  truncated: true,
};

export const packagesTree: ViewNode = {
  kind: 'tree',
  columns: [{ title: 'Package' }],
  roots: [
    {
      cells: [{ text: 'Collections', ref: { id: 'p1', type: 'Package' } }],
      children: [{ cells: [{ text: 'Collections-Abstract', ref: { id: 'p2', type: 'Package' } }], truncated: true }],
    },
  ],
};

export const hierarchySvg: ViewNode = {
  kind: 'svg',
  svg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">' +
    '<script>alert(1)</script>' +
    '<g data-fluid-ref="c1" data-fluid-type="Class" onclick="alert(2)"><rect x="0" y="0" width="80" height="30"/><text x="4" y="20">Collection</text></g>' +
    '<rect x="100" y="0" width="80" height="30"/>' +
    '</svg>',
  hotspots: [{ ref: { id: 'c2', type: 'Class' }, x: 100, y: 0, width: 80, height: 30 }],
};

export const fameTab: ViewNode = {
  kind: 'composite',
  direction: 'column',
  children: [
    { kind: 'composite', direction: 'row', children: [methodsTable, packagesTree] },
    hierarchySvg,
    { kind: 'text', text: 'printOn: aStream\n\taStream << self name', language: 'smalltalk' },
    { kind: 'unsupported', type: 'SpRoassalInspectorPresenter', message: 'animated canvas' },
  ],
};

/** Tabs (Pharo's SpNotebookPresenter) open on the second one. */
export const sourceNotebook: ViewNode = {
  kind: 'tabs',
  selected: 1,
  tabs: [
    { title: 'Methods', node: methodsTable },
    { title: 'Source', node: { kind: 'text', text: 'size\n\t^ tally' } },
  ],
};

/** A diff (SpDiffPresenter) of a method between two commits. */
export const methodDiff: ViewNode = {
  kind: 'diff',
  before: 'size\n\t^ tally',
  after: 'size\n\t^ array size',
  beforeLabel: 'parent',
  language: 'smalltalk',
};

/** A commit view: a header line of labels above the message (GLHSpCommitView). */
export const commitHeader: ViewNode = {
  kind: 'composite',
  direction: 'column',
  children: [
    {
      kind: 'composite',
      direction: 'row',
      children: [
        { kind: 'label', text: 'Commit ' },
        { kind: 'label', text: ' authored ' },
        { kind: 'label', text: '2/10/2026' },
        { kind: 'label', text: ' by ' },
      ],
    },
    { kind: 'text', text: 'do not import already imported information' },
  ],
};

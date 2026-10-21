import { describe, expect, it } from 'vitest';
import { parseViewSpec, type TreeWidget } from '@fluid/shared';
import type { Concept, ConceptField } from '../graphql/introspection';
import { buildDetailView } from './detailView';
import { buildTreeView, recursiveSelection } from './treeView';

function scalar(name: string, typeName = 'String'): ConceptField {
  return { name, description: null, typeName, typeKind: 'SCALAR', isList: false, isScalar: true };
}

function relation(name: string, typeName: string, isList: boolean): ConceptField {
  return { name, description: null, typeName, typeKind: 'OBJECT', isList, isScalar: false };
}

function concept(name: string, relations: ConceptField[], extra: Partial<Concept> = {}): Concept {
  const scalars = [scalar('id', 'ID'), scalar('name')];
  return {
    name,
    description: null,
    fields: [...scalars, ...relations],
    scalarFields: scalars,
    relationFields: relations,
    queries: {},
    ...extra,
  };
}

const related = (...concepts: Concept[]) => ({
  conceptByName: new Map(concepts.map((c) => [c.name, c])),
  queriesByType: new Map(),
});

const treeOf = (widgets: { type: string }[]) => widgets.find((w) => w.type === 'tree') as TreeWidget | undefined;

describe('recursiveSelection', () => {
  it('nests the child field the given number of levels', () => {
    expect(recursiveSelection('id name', 'children', 2)).toBe('id name children { id name children { id name } }');
  });
});

describe('buildTreeView', () => {
  const folder = concept('Folder', [relation('children', 'Folder', true)], {
    queries: { list: { field: 'folders', limitArg: 'first' }, byId: { field: 'folder' } },
  });

  it('builds a valid tree perspective for a recursive concept', () => {
    const view = parseViewSpec(buildTreeView(folder));
    expect(view.id).toBe('auto-tree:Folder');
    expect(view.queries.rows.query).toContain('folders(first: $take) { id name children { id name children {');
    expect(treeOf(view.widgets)).toMatchObject({
      childrenField: 'children',
      keyField: 'id',
      linkTo: { concept: 'Folder', idField: 'id' },
      data: { query: 'rows', path: 'folders' },
    });
  });

  it('builds the tree from parent pointers', () => {
    const category = concept('Category', [relation('parent', 'Category', false)], { queries: { list: { field: 'categories' } } });
    const view = buildTreeView(category)!;
    expect(view.queries.rows.query).toContain('parent { id }');
    expect(treeOf(view.widgets)).toMatchObject({ parentField: 'parent.id' });
  });

  it('builds a container chain with one children field per level', () => {
    const state = concept('State', [relation('country', 'Country', false)]);
    const country = concept('Country', [relation('continent', 'Continent', false), relation('states', 'State', true)]);
    const continent = concept('Continent', [relation('countries', 'Country', true)], { queries: { list: { field: 'continents' } } });
    const view = buildTreeView(continent, related(country, state))!;
    expect(view.queries.rows.query).toContain('countries { id name states { id name } }');
    expect(treeOf(view.widgets)?.childrenField).toEqual(['countries', 'states']);
    // Only the levels with a by-id query open in a new column.
    expect(treeOf(view.widgets)?.linkTo).toEqual([null, null, null]);
    const withById = related(
      { ...country, queries: { byId: { field: 'country' } } },
      state,
    );
    expect(treeOf(buildTreeView(continent, withById)!.widgets)?.linkTo).toEqual([
      null,
      { concept: 'Country', idField: 'id' },
      null,
    ]);
  });

  it('links each node of a container chain in a detail view, from the first level down', () => {
    const state = concept('State', [relation('country', 'Country', false)]);
    const country = concept('Country', [relation('continent', 'Continent', false), relation('states', 'State', true)], {
      queries: { byId: { field: 'country' } },
    });
    const continent = concept('Continent', [relation('countries', 'Country', true)], { queries: { byId: { field: 'continent' } } });
    const tree = treeOf(buildDetailView(continent, related(country, state))!.widgets);
    expect(tree).toMatchObject({ childrenField: ['states'], linkTo: [{ concept: 'Country', idField: 'id' }, null] });
  });

  it('returns null for flat data', () => {
    expect(buildTreeView(concept('Thing', [], { queries: { list: { field: 'things' } } }))).toBeNull();
  });
});

describe('buildDetailView with structure', () => {
  it('shows recursive children as a tree instead of a table', () => {
    const folder = concept('Folder', [relation('children', 'Folder', true)], { queries: { byId: { field: 'folder' } } });
    const view = parseViewSpec(buildDetailView(folder, related(folder)));
    expect(view.widgets.map((w) => w.type)).toEqual(['descriptions', 'tree']);
    expect(treeOf(view.widgets)?.data.path).toBe('folder.children');
  });

  it('gives Markdown properties a richtext widget, and code a code widget, of their own', () => {
    const scalars = [scalar('id', 'ID'), scalar('title'), scalar('body'), scalar('sourceCode'), scalar('code')];
    const post = { ...concept('Post', []), fields: scalars, scalarFields: scalars, queries: { byId: { field: 'post' } } };
    const view = parseViewSpec(buildDetailView(post));
    const details = view.widgets[0];
    expect(details.type === 'descriptions' && details.items.map((i) => i.key)).toEqual(['id', 'title', 'code']);
    expect(view.widgets.filter((w) => w.type === 'richtext')).toMatchObject([{ field: 'body', format: 'markdown' }]);
    expect(view.widgets.filter((w) => w.type === 'code')).toMatchObject([{ field: 'sourceCode' }]);
  });
});

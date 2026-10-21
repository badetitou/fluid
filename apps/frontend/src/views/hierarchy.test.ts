import { describe, expect, it } from 'vitest';
import type { Concept, ConceptField } from '../graphql/introspection';
import { containmentChain, findHierarchy, nextLevelNames } from './hierarchy';

function scalar(name: string, typeName = 'String'): ConceptField {
  return { name, description: null, typeName, typeKind: 'SCALAR', isList: false, isScalar: true };
}

function relation(name: string, typeName: string, isList: boolean): ConceptField {
  return { name, description: null, typeName, typeKind: 'OBJECT', isList, isScalar: false };
}

function concept(name: string, relations: ConceptField[], scalars = [scalar('id', 'ID'), scalar('name')]): Concept {
  return {
    name,
    description: null,
    fields: [...scalars, ...relations],
    scalarFields: scalars,
    relationFields: relations,
    queries: {},
  };
}

const byName = (...concepts: Concept[]) => new Map(concepts.map((c) => [c.name, c]));

describe('findHierarchy', () => {
  it('finds recursive children on a type listing itself', () => {
    const folder = concept('Folder', [relation('owner', 'User', false), relation('children', 'Folder', true)]);
    expect(findHierarchy(folder)).toMatchObject({ kind: 'children', field: { name: 'children' } });
  });

  it('prefers a children-like name among several self lists', () => {
    const category = concept('Category', [relation('related', 'Category', true), relation('subcategories', 'Category', true)]);
    expect(findHierarchy(category)).toMatchObject({ kind: 'children', field: { name: 'subcategories' } });
  });

  it('finds recursive children through another type holding the same field', () => {
    const node = concept('Node', [relation('children', 'Node', true)]);
    const folder = concept('Folder', [relation('children', 'Node', true)]);
    expect(findHierarchy(folder, byName(node))).toMatchObject({ kind: 'children', field: { name: 'children' } });
  });

  it('finds a parent pointer', () => {
    const category = concept('Category', [relation('parent', 'Category', false)]);
    expect(findHierarchy(category)).toMatchObject({ kind: 'parent', field: { name: 'parent' } });
  });

  it('skips fields that need arguments', () => {
    const children = { ...relation('children', 'Folder', true), hasRequiredArgs: true };
    expect(findHierarchy(concept('Folder', [children]))).toBeNull();
  });

  it('follows a container chain whose items point back to their container', () => {
    const state = concept('State', [relation('country', 'Country', false)]);
    const country = concept('Country', [relation('continent', 'Continent', false), relation('states', 'State', true)]);
    const continent = concept('Continent', [relation('countries', 'Country', true)]);
    const h = findHierarchy(continent, byName(country, state));
    expect(h?.kind).toBe('levels');
    expect(h?.kind === 'levels' && h.fields.map((f) => f.name)).toEqual(['countries', 'states']);
  });

  it('does not treat many-to-many lists as containment', () => {
    const episode = concept('Episode', [relation('characters', 'Character', true)]);
    const character = concept('Character', [relation('location', 'Location', false), relation('episode', 'Episode', true)]);
    const location = concept('Location', [relation('residents', 'Character', true)]);
    expect(containmentChain(location, byName(character, episode)).fields.map((f) => f.name)).toEqual(['residents']);
    // A single level is a plain list relation, not a tree.
    expect(findHierarchy(location, byName(character, episode))).toBeNull();
  });
});

describe('nextLevelNames', () => {
  it('lists the list relations of related types not yet known', () => {
    const country = concept('Country', [relation('continent', 'Continent', false), relation('states', 'State', true), relation('languages', 'Language', true)]);
    expect(nextLevelNames(byName(country), ['Continent']).sort()).toEqual(['Language', 'State']);
  });
});

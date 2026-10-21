import type { Concept, ConceptField } from '../graphql/introspection';

// Detection of hierarchies in an introspected schema, so the auto views can
// offer a tree where the data has one:
// - a type holding a list of itself (`children: [Category]`, `replies: [Comment]`);
// - a type pointing to one of itself (`parent: Category`);
// - a containment chain of different types, where each child points back to its
//   container (`Continent.countries` / `Country.continent`, then `Country.states`
//   / `State.country`). Many-to-many lists (`Episode.characters`) are not containment.

export type Hierarchy =
  | { kind: 'children'; field: ConceptField }
  | { kind: 'parent'; field: ConceptField }
  | { kind: 'levels'; fields: ConceptField[]; concepts: Concept[] };

const CHILDREN_NAMES = /(children|childs|subitems|items|nodes|subtasks|tasks|replies|answers|subfolders|folders|files|entries|contents|members|subcategories|descendants|kids)$/i;
const PARENT_NAMES = /(parent|container|folder|directory|owner|manager|superior)$/i;

/** Longest container chain looked for (levels below the concept). */
export const MAX_LEVELS = 3;

const usable = (f: ConceptField) => !f.hasRequiredArgs;

function preferNamed(fields: ConceptField[], names: RegExp): ConceptField | undefined {
  return fields.find((f) => names.test(f.name)) ?? fields[0];
}

/** List fields through which a concept holds more of itself. */
export function recursiveChildrenField(
  concept: Concept,
  conceptByName?: Map<string, Concept>,
): ConceptField | undefined {
  const candidates = concept.relationFields.filter((f) => {
    if (!f.isList || !usable(f)) return false;
    if (f.typeName === concept.name) return true;
    // e.g. `Folder.children: [Node]` where every node has `children` too.
    const target = conceptByName?.get(f.typeName);
    return CHILDREN_NAMES.test(f.name) && Boolean(target?.fields.some((g) => g.name === f.name && g.isList));
  });
  return preferNamed(candidates, CHILDREN_NAMES);
}

/** Single field pointing to the concept's own parent. */
export function parentField(concept: Concept): ConceptField | undefined {
  const candidates = concept.relationFields.filter((f) => !f.isList && usable(f) && f.typeName === concept.name);
  return preferNamed(candidates, PARENT_NAMES);
}

/** Whether `child` points back to `container` through a single (non-list) field. */
function pointsBack(child: Concept, container: Concept): boolean {
  return child.relationFields.some((f) => !f.isList && f.typeName === container.name);
}

/** Container chain below a concept, following list relations whose items point back to their container. */
export function containmentChain(
  concept: Concept,
  conceptByName: Map<string, Concept>,
): { fields: ConceptField[]; concepts: Concept[] } {
  const fields: ConceptField[] = [];
  const concepts: Concept[] = [];
  const seen = new Set([concept.name]);
  let current = concept;
  while (fields.length < MAX_LEVELS) {
    const next = current.relationFields
      .filter((f) => f.isList && usable(f) && !seen.has(f.typeName))
      .map((f) => ({ f, target: conceptByName.get(f.typeName) }))
      .find(({ target }) => target && target.scalarFields.length > 0 && pointsBack(target, current));
    if (!next?.target) break;
    fields.push(next.f);
    concepts.push(next.target);
    seen.add(next.target.name);
    current = next.target;
  }
  return { fields, concepts };
}

/**
 * The hierarchy a concept's data has, if any: recursive children first, then a
 * parent pointer, then a container chain of at least two levels (one level is
 * just a list relation, already shown as a table).
 */
export function findHierarchy(concept: Concept, conceptByName: Map<string, Concept> = new Map()): Hierarchy | null {
  const children = recursiveChildrenField(concept, conceptByName);
  if (children) return { kind: 'children', field: children };
  const parent = parentField(concept);
  if (parent) return { kind: 'parent', field: parent };
  const chain = containmentChain(concept, conceptByName);
  return chain.fields.length >= 2 ? { kind: 'levels', ...chain } : null;
}

/**
 * Types to introspect one level further than a concept's related ones, so a
 * container chain can be followed: the list relations of the related types
 * (e.g. `Country.states` when looking at a continent).
 */
export function nextLevelNames(conceptByName: Map<string, Concept>, known: Iterable<string>): string[] {
  const skip = new Set(known);
  const names = new Set<string>();
  for (const related of conceptByName.values()) {
    for (const f of related.relationFields) {
      if (f.isList && !skip.has(f.typeName) && !conceptByName.has(f.typeName)) names.add(f.typeName);
    }
  }
  return [...names];
}

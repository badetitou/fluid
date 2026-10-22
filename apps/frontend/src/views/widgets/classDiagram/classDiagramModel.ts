import type { ClassDiagramWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { buildNetwork, rowsOf } from '../network/networkModel';
import { nodeLabel, type Row } from '../tree/treeModel';

// Pure logic of the class diagram: turns the bound classes (and the
// superclasses nested in them, at any depth) into a forest, each class under
// its first superclass, without cycles.

export interface UmlClass {
  /** The class's id, as a string: unique within the diagram. */
  key: string;
  label: string;
  row: Row;
  /** Value of `groupField` (its package), when the class has one. */
  group?: string;
  abstract: boolean;
  attributes: string[];
  methods: string[];
  /** The superclass the class is drawn under. */
  parent?: string;
  /** Names of its other superclasses (multiple inheritance, or a link that would close a cycle). */
  others: string[];
  /** Its direct subclasses, by name. */
  children: string[];
  /** How many classes are below it, at any depth. */
  descendants: number;
  /** 0 for a root. */
  depth: number;
}

export interface ClassForest {
  classes: ReadonlyMap<string, UmlClass>;
  /** The classes without superclass: the largest hierarchy first. */
  roots: string[];
  /** The group values, in order of appearance. */
  groups: string[];
}

export type ClassDiagramOptions = Pick<
  ClassDiagramWidget,
  'idField' | 'labelField' | 'superField' | 'attributesField' | 'methodsField' | 'memberLabelField' | 'abstractField' | 'groupField'
>;

/** The labels of a member list: strings as they are, objects by `labelField` (else name, title…). */
export function memberLabels(row: Row, field: string | undefined, labelField?: string): string[] {
  if (!field) return [];
  const value = getPath(row, field);
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return items.flatMap((item) => {
    if (typeof item === 'string' || typeof item === 'number') return [String(item)];
    const [member] = rowsOf(item);
    return member ? [nodeLabel(member, labelField)] : [];
  });
}

const isTrue = (value: unknown) => value === true || value === 'true';
const byLabel = (classes: ReadonlyMap<string, UmlClass>) => (a: string, b: string) =>
  (classes.get(a)?.label ?? a).localeCompare(classes.get(b)?.label ?? b);

/** Whether `ancestor` is `key` or above it, following the superclasses assigned so far. */
function isAbove(ancestor: string, key: string, parents: ReadonlyMap<string, string>): boolean {
  const seen = new Set<string>();
  for (let at: string | undefined = key; at !== undefined && !seen.has(at); at = parents.get(at)) {
    if (at === ancestor) return true;
    seen.add(at);
  }
  return false;
}

/** Each class's superclass: its first one that does not close a cycle. */
function primaryParents(order: string[], supers: ReadonlyMap<string, string[]>): Map<string, string> {
  const parents = new Map<string, string>();
  for (const key of order) {
    const parent = (supers.get(key) ?? []).find((s) => !isAbove(key, s, parents));
    if (parent !== undefined) parents.set(key, parent);
  }
  return parents;
}

/** Fills depths and descendant counts, from the roots down (the forest has no cycle). */
function measureForest(classes: Map<string, UmlClass>, roots: string[]): void {
  const order: string[] = [];
  const stack = [...roots];
  while (stack.length) {
    const key = stack.pop()!;
    order.push(key);
    const cls = classes.get(key)!;
    for (const child of cls.children) {
      classes.get(child)!.depth = cls.depth + 1;
      stack.push(child);
    }
  }
  for (const key of order.reverse()) {
    const cls = classes.get(key)!;
    cls.descendants = cls.children.reduce((sum, c) => sum + 1 + classes.get(c)!.descendants, 0);
  }
}

/** Builds the forest: the bound classes and every superclass reached through `superField`. */
export function buildClassForest(data: unknown, opts: ClassDiagramOptions): ClassForest {
  const network = buildNetwork(data, undefined, {
    idField: opts.idField,
    labelField: opts.labelField,
    groupField: opts.groupField,
    linksField: opts.superField,
  });
  const supers = new Map<string, string[]>();
  for (const edge of network.edges) supers.set(edge.source, [...(supers.get(edge.source) ?? []), edge.target]);
  const parents = primaryParents(network.nodes.map((n) => n.key), supers);

  const classes = new Map<string, UmlClass>();
  for (const node of network.nodes) {
    classes.set(node.key, {
      key: node.key,
      label: node.label,
      row: node.row,
      group: node.group,
      abstract: opts.abstractField ? isTrue(getPath(node.row, opts.abstractField)) : false,
      attributes: memberLabels(node.row, opts.attributesField, opts.memberLabelField),
      methods: memberLabels(node.row, opts.methodsField, opts.memberLabelField),
      parent: parents.get(node.key),
      others: [],
      children: [],
      descendants: 0,
      depth: 0,
    });
  }
  const label = (key: string) => classes.get(key)?.label ?? key;
  for (const cls of classes.values()) {
    cls.others = (supers.get(cls.key) ?? []).filter((s) => s !== cls.parent).map(label);
    if (cls.parent !== undefined) classes.get(cls.parent)?.children.push(cls.key);
  }
  for (const cls of classes.values()) cls.children.sort(byLabel(classes));
  const roots = [...classes.values()].filter((c) => c.parent === undefined).map((c) => c.key);
  measureForest(classes, roots);
  roots.sort((a, b) => classes.get(b)!.descendants - classes.get(a)!.descendants || byLabel(classes)(a, b));
  return { classes, roots, groups: network.groups };
}

/** Why there is nothing to draw, or null when there are classes. */
export function emptyReason(data: unknown, forest: ClassForest, idField = 'id'): string | null {
  if (forest.classes.size > 0) return null;
  return rowsOf(data).length === 0
    ? 'No classes: the query returned no rows.'
    : `No class has an id: select "${idField}" in the query, or set "idField".`;
}

/** Why no inheritance is drawn (no class has a superclass), or null when some is. */
export function missingSuperReason(forest: ClassForest, superField: string): string | null {
  return forest.roots.length < forest.classes.size ? null : `No inheritance: no class has a superclass in "${superField}".`;
}

/** The classes unfolded at first: those with subclasses above `depth` (0 folds everything). */
export function initialExpanded(forest: ClassForest, depth: number): Set<string> {
  return new Set([...forest.classes.values()].filter((c) => c.children.length > 0 && c.depth < depth).map((c) => c.key));
}

/** Every class with subclasses: what "unfold all" unfolds. */
export const expandableKeys = (forest: ClassForest): Set<string> => initialExpanded(forest, Infinity);

/** The superclasses a class is drawn under, from its parent up to its root. */
export function ancestorsOf(forest: ClassForest, key: string): string[] {
  const out: string[] = [];
  for (let at = forest.classes.get(key)?.parent; at !== undefined; at = forest.classes.get(at)?.parent) out.push(at);
  return out;
}

/** How many classes are hidden below a class: all its descendants when folded, none when unfolded. */
export const hiddenBelow = (cls: UmlClass, expanded: ReadonlySet<string>): number =>
  expanded.has(cls.key) ? 0 : cls.descendants;

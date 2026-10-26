import type { BlueprintWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { idOf, rowsOf } from '../network/networkModel';
import { nodeLabel, type Row } from '../tree/treeModel';

// Pure logic of the class blueprint: reads the class's methods and attributes,
// the calls and accesses between them, and puts each method in its layer
// (Moose's CBView: initialization, external interface, internal
// implementation, accessors), the internal ones by call depth.

export type Layer = 'initialization' | 'external' | 'internal' | 'accessor';
/** What colors a method box. */
export type MethodKind = 'abstract' | 'overriding' | 'constructor' | 'accessor' | 'plain';

export interface BlueprintMethod {
  key: string;
  label: string;
  row: Row;
  layer: Layer;
  kind: MethodKind;
  /** Lines of code, when `sizeField` gives them. */
  size?: number;
  /** The class's methods it calls (keys, itself excluded). */
  calls: string[];
  /** The class's attributes it accesses (keys). */
  accesses: string[];
  /** For an internal method: 1 when called by a non-internal method, 2 below… (0 elsewhere). */
  depth: number;
}

export interface BlueprintAttribute {
  key: string;
  label: string;
  row: Row;
}

export interface Blueprint {
  methods: BlueprintMethod[];
  attributes: BlueprintAttribute[];
}

export type BlueprintOptions = Omit<
  BlueprintWidget,
  'id' | 'type' | 'title' | 'span' | 'height' | 'data' | 'layout' | 'linkTo' | 'attributeLinkTo'
>;

/** Above it, the blueprint is unreadable (and slow): a message asks to filter. */
export const MAX_METHODS = 300;
/** Internal methods deeper than this share the last internal column. */
export const MAX_INTERNAL_DEPTH = 3;

const LABEL_FIELDS = ['name', 'selector', 'signature'];
const CONSTRUCTOR_NAME = /^(initiali[sz]e|init\b|<init>|<clinit>|__init__|constructor$|new\b)/i;
const ACCESSOR_MAX_LINES = 3;
/** Key prefixes: a method and an attribute may have the same id. */
const METHOD = 'm:';
const ATTRIBUTE = 'a:';

const isTrue = (value: unknown) => value === true || value === 'true';
const flag = (row: Row, field: string | undefined): boolean | undefined =>
  field === undefined ? undefined : isTrue(getPath(row, field));

/** A member's label: `labelField`, else its name or selector, else the usual label fields. */
function label(row: Row, labelField: string | undefined): string {
  const named = LABEL_FIELDS.find((f) => {
    const value = getPath(row, f);
    return typeof value === 'string' && value !== '';
  });
  return nodeLabel(row, labelField ?? named);
}

/** The keys (`prefix` + id) found at `field` in a row: scalar ids, or objects holding `idField`. */
function idsAt(row: Row, field: string | undefined, idField: string, prefix: string): string[] {
  if (!field) return [];
  const value = getPath(row, field);
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  const ids = items.flatMap((item) => {
    const id = idOf(item, idField);
    return id === undefined ? [] : [prefix + id];
  });
  return [...new Set(ids)];
}

const sizeOf = (row: Row, field: string | undefined): number | undefined => {
  const n = field ? Number(getPath(row, field)) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** The class bound to the widget: the object itself, or the first row of a list. */
export const classOf = (data: unknown): Row | undefined => rowsOf(data)[0];

/** The rows of a member list of the class, with their unique keys (`prefix` + id). */
function members(
  cls: Row,
  field: string | undefined,
  idField: string,
  prefix: string,
): { key: string; row: Row }[] {
  if (!field) return [];
  const seen = new Set<string>();
  return rowsOf(getPath(cls, field)).flatMap((row) => {
    const id = idOf(row, idField);
    const key = prefix + id;
    if (id === undefined || seen.has(key)) return [];
    seen.add(key);
    return [{ key, row }];
  });
}

/** Internal call depth: shortest distance from a non-internal method (1 = called by one directly). */
function internalDepths(methods: BlueprintMethod[]): void {
  const byKey = new Map(methods.map((m) => [m.key, m]));
  let frontier = methods.filter((m) => m.layer !== 'internal');
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: BlueprintMethod[] = [];
    for (const caller of frontier)
      for (const callee of caller.calls.map((k) => byKey.get(k)!))
        if (callee.layer === 'internal' && callee.depth === 0) {
          callee.depth = depth;
          next.push(callee);
        }
    frontier = next;
  }
  for (const m of methods) if (m.layer === 'internal' && m.depth === 0) m.depth = 1;
}

function layerOf(info: {
  constructor: boolean;
  accessor: boolean;
  isPublic?: boolean;
  external: boolean;
  internal: boolean;
}): Layer {
  if (info.constructor) return 'initialization';
  if (info.accessor) return 'accessor';
  if (info.isPublic === false) return 'internal';
  if (info.external) return 'external';
  return info.internal ? 'internal' : 'external';
}

/** Builds the blueprint of the class bound to the widget (empty when there is none). */
export function buildBlueprint(data: unknown, opts: BlueprintOptions): Blueprint {
  const cls = classOf(data);
  if (!cls) return { methods: [], attributes: [] };
  const idField = opts.idField ?? 'id';
  const attributes = members(cls, opts.attributesField, idField, ATTRIBUTE).map(({ key, row }) => ({
    key,
    row,
    label: label(row, opts.labelField),
  }));
  const attributeKeys = new Set(attributes.map((a) => a.key));
  const rows = members(cls, opts.methodsField, idField, METHOD);
  const methodKeys = new Set(rows.map((r) => r.key));

  const methods: BlueprintMethod[] = rows.map(({ key, row }) => ({
    key,
    row,
    label: label(row, opts.labelField),
    layer: 'external',
    kind: 'plain',
    size: sizeOf(row, opts.sizeField),
    calls: idsAt(row, opts.callsField, idField, METHOD).filter(
      (k) => k !== key && methodKeys.has(k),
    ),
    accesses: idsAt(row, opts.accessesField, idField, ATTRIBUTE).filter((k) =>
      attributeKeys.has(k),
    ),
    depth: 0,
  }));
  const calledInternally = new Set(methods.flatMap((m) => m.calls));

  for (const m of methods) {
    const internal = calledInternally.has(m.key);
    const constructor =
      flag(m.row, opts.isConstructorField) ?? (!internal && CONSTRUCTOR_NAME.test(m.label));
    const accessor =
      flag(m.row, opts.isAccessorField) ??
      (m.accesses.length === 1 &&
        m.calls.length === 0 &&
        (m.size === undefined || m.size <= ACCESSOR_MAX_LINES));
    const external = idsAt(m.row, opts.callersField, idField, METHOD).some(
      (k) => !methodKeys.has(k),
    );
    m.layer = layerOf({
      constructor,
      accessor,
      isPublic: flag(m.row, opts.isPublicField),
      external,
      internal,
    });
    m.kind = flag(m.row, opts.isAbstractField)
      ? 'abstract'
      : flag(m.row, opts.isOverridingField)
        ? 'overriding'
        : constructor
          ? 'constructor'
          : accessor
            ? 'accessor'
            : 'plain';
  }
  internalDepths(methods);
  return { methods, attributes };
}

/** Why there is nothing to draw (or too much), or null when the blueprint can be drawn. */
export function blueprintProblem(
  data: unknown,
  blueprint: Blueprint,
  opts: Pick<BlueprintOptions, 'methodsField' | 'idField'>,
): string | null {
  if (blueprint.methods.length > MAX_METHODS)
    return `Too many methods (${blueprint.methods.length}, over ${MAX_METHODS}): the blueprint would be unreadable. Filter the methods in the query.`;
  if (blueprint.methods.length > 0) return null;
  const cls = classOf(data);
  if (!cls) return 'No class: the query returned nothing.';
  if (rowsOf(getPath(cls, opts.methodsField)).length === 0)
    return `No methods: "${opts.methodsField}" is empty or not selected in the query.`;
  return `No method has an id: select "${opts.idField ?? 'id'}" in the methods, or set "idField".`;
}

/** What hovering an element highlights: itself, its calls and accesses (a method) or the methods accessing it. */
export function relatedKeys(blueprint: Blueprint, key: string): Set<string> {
  const related = new Set([key]);
  for (const m of blueprint.methods) {
    if (m.key === key) for (const k of [...m.calls, ...m.accesses]) related.add(k);
    else if (m.calls.includes(key) || m.accesses.includes(key)) related.add(m.key);
  }
  return related;
}

import { Kind, parse, print, visit, type DocumentNode, type FieldNode, type OperationDefinitionNode } from 'graphql';

/**
 * Row paging of a view's queries. A query takes part when it declares a
 * `$take` variable: fluid sets it to the source's row limit, tells when the
 * answer may have been cut, and loads more rows on demand — with the source's
 * offset argument (`skip`, `offset`) when it has one, else with a bigger take.
 */

/** How the connected source pages its lists (see the source settings). */
export interface RowPaging {
  /** Rows loaded at first; the view's own `take` when unset. */
  rowLimit?: number;
  /** Most rows the source answers per request (e.g. 1000 for Moose); unknown when unset. */
  maxPerRequest?: number;
  /** Argument skipping the first rows of a list (`skip`, `offset`), when the source has one. */
  offsetArg?: string;
}

/** What is loaded of one query's rows. */
export interface RowsState {
  /** Rows of the longest paged list of the answer. */
  loaded: number;
  /** The answer may have been cut: as many rows as asked (or as the source answers at most). */
  truncated: boolean;
  /** Rows to ask for a "load more". */
  step: number;
  /** More rows are read page by page with the offset argument (else with one bigger take). */
  paged: boolean;
  /** fluid can ask more rows: cut, and the source can still answer more (offset, or under its cap). */
  more: boolean;
}

/** Largest GraphQL `Int`: "every row" for a source that cannot page. */
export const ALL_ROWS = 2 ** 31 - 1;
/** The variable fluid adds for the offset argument. */
export const SKIP_VARIABLE = 'fluidSkip';

const TAKE = 'take';

function operation(doc: DocumentNode): OperationDefinitionNode | undefined {
  return doc.definitions.find((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
}

function tryParse(query: string): DocumentNode | null {
  try {
    return parse(query);
  } catch {
    return null;
  }
}

const takesVariable = (field: FieldNode): boolean =>
  (field.arguments ?? []).some((a) => a.value.kind === Kind.VARIABLE && a.value.name.value === TAKE);

/** Whether the query declares `$take`, the variable fluid pages with. */
export function isPaged(query: string): boolean {
  const doc = tryParse(query);
  const vars = doc ? (operation(doc)?.variableDefinitions ?? []) : [];
  return vars.some((v) => v.variable.name.value === TAKE);
}

const fieldsOf = (selections: readonly { kind: Kind }[] | undefined): FieldNode[] =>
  (selections ?? []).filter((s): s is FieldNode => s.kind === Kind.FIELD);

/**
 * The fields limited by `$take` that page the answer, with their response
 * paths (aliases or names). A `$take` field inside another one is a list per
 * row (e.g. each entity's methods): it is not paged, nor looked into.
 */
function pagedFields(doc: DocumentNode): { field: FieldNode; path: string[] }[] {
  const found: { field: FieldNode; path: string[] }[] = [];
  const walk = (fields: FieldNode[], at: string[]) => {
    for (const field of fields) {
      const path = [...at, field.alias?.value ?? field.name.value];
      if (takesVariable(field)) found.push({ field, path });
      else walk(fieldsOf(field.selectionSet?.selections), path);
    }
  };
  walk(fieldsOf(operation(doc)?.selectionSet.selections), []);
  return found;
}

/** Response paths of the fields that page the answer (see `pagedFields`). */
export function pagedPaths(query: string): string[][] {
  const doc = tryParse(query);
  return doc ? pagedFields(doc).map((f) => f.path) : [];
}

/**
 * The query with `<offsetArg>: $fluidSkip` on the field that pages the answer,
 * and `$fluidSkip: Int` declared; `null` if it cannot be read or does not page
 * exactly one field (one offset cannot page several lists of different lengths).
 */
export function withOffset(query: string, offsetArg: string): string | null {
  const doc = tryParse(query);
  if (!doc) return null;
  const paged = pagedFields(doc);
  if (paged.length !== 1) return null;
  const target = paged[0].field;
  const skipValue = { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: SKIP_VARIABLE } } as const;
  const out = visit(doc, {
    OperationDefinition(node) {
      const declared = (node.variableDefinitions ?? []).some((v) => v.variable.name.value === SKIP_VARIABLE);
      if (declared) return undefined;
      const definition = {
        kind: Kind.VARIABLE_DEFINITION,
        variable: skipValue,
        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: 'Int' } },
      } as const;
      return { ...node, variableDefinitions: [...(node.variableDefinitions ?? []), definition] };
    },
    Field(node) {
      if (node !== target || node.arguments?.some((a) => a.name.value === offsetArg)) return undefined;
      const arg = { kind: Kind.ARGUMENT, name: { kind: Kind.NAME, value: offsetArg }, value: skipValue } as const;
      return { ...node, arguments: [...(node.arguments ?? []), arg] };
    },
  });
  return print(out);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Rows at a paged path: the list itself, or the longest list of a pagination wrapper. */
function rowsAt(data: unknown, path: string[]): number {
  let value: unknown = data;
  for (const key of path) {
    if (Array.isArray(value)) return 0; // a list nested in another list: not paged as one
    value = isRecord(value) ? value[key] : undefined;
  }
  if (Array.isArray(value)) return value.length;
  if (!isRecord(value)) return 0;
  return Math.max(0, ...Object.values(value).map((v) => (Array.isArray(v) ? v.length : 0)));
}

/** Rows of the longest paged list of an answer. */
export const countRows = (data: unknown, paths: string[][]): number =>
  Math.max(0, ...paths.map((p) => rowsAt(data, p)));

/** An answer may have been cut when it has as many rows as asked, or as the source answers at most. */
export function mayBeTruncated(rows: number, asked: number, maxPerRequest?: number): boolean {
  const ceiling = maxPerRequest ? Math.min(asked, maxPerRequest) : asked;
  return rows > 0 && rows >= ceiling;
}

/** A copy of `value` where the list at `path` (or the lists of the wrapper there) is extended with `next`'s. */
function appendAt(value: unknown, next: unknown, path: string[]): unknown {
  if (path.length > 0) {
    const [key, ...rest] = path;
    if (!isRecord(value) || !isRecord(next)) return value;
    return { ...value, [key]: appendAt(value[key], next[key], rest) };
  }
  if (Array.isArray(value) && Array.isArray(next)) return [...value, ...next];
  if (!isRecord(value) || !isRecord(next)) return value;
  const out: Record<string, unknown> = { ...value };
  for (const [k, v] of Object.entries(value)) {
    const more = next[k];
    if (Array.isArray(v) && Array.isArray(more)) out[k] = [...v, ...more];
  }
  return out;
}

/** Two pages of one answer put together: the paged lists are concatenated, the rest kept from the first page. */
export const mergePages = (first: unknown, next: unknown, paths: string[][]): unknown =>
  paths.reduce((acc, path) => appendAt(acc, next, path), first);

/** Query key -> the first widget reading it: the one showing that query's rows banner. */
export function bannerOwners(widgets: readonly { id: string; data?: { query: string } }[]): Record<string, string> {
  const owners: Record<string, string> = {};
  for (const w of widgets) if (w.data && !(w.data.query in owners)) owners[w.data.query] = w.id;
  return owners;
}

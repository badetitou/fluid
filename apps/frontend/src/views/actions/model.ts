import { parseActionRef, parseMutationDocument, splitMutationName, type ActionSpec } from '@fluid/shared';
import { getPath } from '../data';

// Running an action, the pure parts: its variables resolved against what the
// user acted upon, then the view's results patched with what the mutation
// wrote, so the screen follows without waiting for a refetch (and even when the
// source does not persist, like GraphQLZero). See docs/architecture/MUTATIONS.md §6.

/** What a widget hands to an action: the item acted upon and the values entered. */
export interface ActionContext {
  target?: unknown;
  form?: unknown;
}

export type ActionResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Field identifying an item across results. */
const KEY = 'id';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The variables of an action, with `$target` / `$form` references replaced by their values. */
export function resolveActionVariables(variables: ActionSpec['variables'], context: ActionContext): Json {
  const resolve = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const parsed = parseActionRef(value);
      if ('literal' in parsed) return parsed.literal;
      if ('error' in parsed) return value;
      return getPath(context[parsed.ref.source], parsed.ref.path);
    }
    if (Array.isArray(value)) return value.map(resolve);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
    return value;
  };
  return resolve(variables ?? {}) as Json;
}

/** Root fields of the action's mutation that delete what they are given. */
export function deletingFields(action: ActionSpec): string[] {
  const parsed = parseMutationDocument(action.mutation);
  return parsed.ok ? parsed.document.fields.filter((f) => splitMutationName(f).kind === 'delete') : [];
}

/** `Todo:3` for an item with a key, `__typename` included when known; null otherwise. */
function identity(value: unknown): string | null {
  if (!isObject(value) || value[KEY] == null) return null;
  return `${String(value.__typename ?? '')}:${String(value[KEY])}`;
}

/** Same item: same key and, when both tell it, same type. */
function sameItem(a: Json, b: Json): boolean {
  if (a[KEY] == null || String(a[KEY]) !== String(b[KEY])) return false;
  return a.__typename == null || b.__typename == null || a.__typename === b.__typename;
}

function deepMerge(base: Json, patch: Json): Json {
  const out: Json = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

/** Rebuilds `value`, mapping each object (deepest first) and filtering array items. */
function rewrite(value: unknown, mapObject: (o: Json) => Json, keep: (item: unknown) => boolean): unknown {
  if (Array.isArray(value)) return value.filter(keep).map((v) => rewrite(v, mapObject, keep));
  if (!isObject(value)) return value;
  const rebuilt = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, mapObject, keep)]));
  return mapObject(rebuilt);
}

/** Every keyed object a mutation returned, at its root fields (lists included). */
function writtenItems(data: unknown): Json[] {
  if (!isObject(data)) return [];
  return Object.values(data)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is Json => identity(v) !== null);
}

/**
 * The view's results after a mutation: the items it returned are merged into
 * their copies wherever they appear, and a deleted target leaves the lists
 * holding it. A created item is not inserted: where it belongs is the refetch's business.
 */
export function patchResults(
  results: Record<string, unknown>,
  data: unknown,
  deleted?: unknown,
): Record<string, unknown> {
  const written = writtenItems(data);
  const gone = isObject(deleted) && identity(deleted) ? deleted : null;
  if (written.length === 0 && !gone) return results;
  const mapObject = (o: Json) => written.reduce((acc, w) => (sameItem(acc, w) ? deepMerge(acc, w) : acc), o);
  const keep = (item: unknown) => !(gone && isObject(item) && sameItem(item, gone));
  return Object.fromEntries(Object.entries(results).map(([k, v]) => [k, rewrite(v, mapObject, keep)]));
}

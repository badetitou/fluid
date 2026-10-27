import { z } from 'zod';
import {
  actionSpecSchema,
  querySpecSchema,
  widgetSchema,
  type ActionSpec,
  type QuerySpec,
  type ViewSpec,
  type Widget,
} from '@fluid/shared';

// Copying a widget from one view and pasting it into another. A widget reads
// the view's queries and runs its actions by key, so it travels with the ones
// it uses; pasting renames those whose key the target view already uses for
// something else, and gives the widget an id no other widget there has.

/** A copied widget, with the queries and actions of its view it uses. */
export const copiedWidgetSchema = z.object({
  fluid: z.literal('widget'),
  widget: widgetSchema,
  queries: z.record(z.string(), querySpecSchema),
  actions: z.record(z.string(), actionSpecSchema),
});
export type CopiedWidget = z.infer<typeof copiedWidgetSchema>;

/** What pasted widgets add to a view besides themselves. */
export interface SpecAdditions {
  queries: Record<string, QuerySpec>;
  actions: Record<string, ActionSpec>;
}
export const NO_ADDITIONS: SpecAdditions = { queries: {}, actions: {} };

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

// `$item` (an accordion's element) and `@<id>` (another widget's output) are not queries of the view.
const queryRef = (obj: Json): string | undefined =>
  isRecord(obj.data) && typeof obj.data.query === 'string' && !/^[$@]/.test(obj.data.query) ? obj.data.query : undefined;
const actionRef = (obj: Json): string | undefined => (typeof obj.action === 'string' ? obj.action : undefined);

/** Every object of a value, nested widgets and row actions included. */
function objects(value: unknown): Json[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  return isRecord(value) ? [value, ...Object.values(value).flatMap(objects)] : [];
}

/** A copy of `value` whose query and action references are renamed. */
function renameRefs(value: unknown, queries: Map<string, string>, actions: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => renameRefs(v, queries, actions));
  if (!isRecord(value)) return value;
  const out: Json = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameRefs(v, queries, actions)]));
  const query = queryRef(out);
  if (query && queries.has(query) && isRecord(out.data)) out.data = { ...out.data, query: queries.get(query) };
  const action = actionRef(out);
  if (action && actions.has(action)) out.action = actions.get(action);
  return out;
}

const pick = <T>(record: Record<string, T>, keys: Iterable<string>): Record<string, T> =>
  Object.fromEntries([...keys].flatMap((k) => (k in record ? [[k, record[k]] as const] : [])));

/** `base`, or `base-2`, `base-3`… whichever `taken` refuses first. */
export function uniqueKey(base: string, isTaken: (key: string) => boolean): string {
  let key = base;
  for (let n = 2; isTaken(key); n++) key = `${base}-${n}`;
  return key;
}

/** The widget of a view, ready to paste elsewhere. */
export function copyWidget(widget: Widget, spec: Pick<ViewSpec, 'queries' | 'actions'>): CopiedWidget {
  const found = objects(widget);
  const actions = pick(spec.actions ?? {}, found.flatMap((o) => actionRef(o) ?? []));
  const queryKeys = [...found.flatMap((o) => queryRef(o) ?? []), ...Object.values(actions).flatMap((a) => a.refetch ?? [])];
  return { fluid: 'widget', widget, queries: pick(spec.queries, queryKeys), actions };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keys `source` entries take among `target`'s: their own, unless it means something else there. */
function mergeKeys<T>(source: Record<string, T>, target: Record<string, T>) {
  const renames = new Map<string, string>();
  const added: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    const taken = (k: string) => (k in target && !same(target[k], value)) || (k in added && !same(added[k], value));
    const free = uniqueKey(key, taken);
    renames.set(key, free);
    if (!(free in target)) added[free] = value;
  }
  return { renames, added };
}

interface PasteTarget {
  widgets: Widget[];
  queries: Record<string, QuerySpec>;
  actions?: Record<string, ActionSpec>;
}

/**
 * The copied widget as it lands in a view: a free id, no grid placement (it
 * goes below the others), and references to the queries and actions it brings.
 */
export function pasteWidget(copied: CopiedWidget, target: PasteTarget): { widget: Widget; additions: SpecAdditions } {
  const queries = mergeKeys(copied.queries, target.queries);
  const renamedActions = Object.fromEntries(
    Object.entries(copied.actions).map(([key, action]) => [
      key,
      action.refetch ? { ...action, refetch: action.refetch.map((q) => queries.renames.get(q) ?? q) } : action,
    ]),
  );
  const actions = mergeKeys(renamedActions, target.actions ?? {});
  // Renaming references keeps the widget's shape: only the values of `data.query` and `action` change.
  const renamed = renameRefs(copied.widget, queries.renames, actions.renames) as Widget;
  const ids = new Set(target.widgets.map((w) => w.id));
  const widget: Widget = { ...renamed, id: uniqueKey(copied.widget.id, (id) => ids.has(id)) };
  delete widget.layout;
  return { widget, additions: { queries: queries.added, actions: actions.added } };
}

/** Both additions together. */
export const mergeAdditions = (a: SpecAdditions, b: SpecAdditions): SpecAdditions => ({
  queries: { ...a.queries, ...b.queries },
  actions: { ...a.actions, ...b.actions },
});

/** The view with the queries and actions pasted widgets brought. */
export function withAdditions(spec: ViewSpec, additions: SpecAdditions): ViewSpec {
  const hasActions = Object.keys(additions.actions).length > 0;
  return {
    ...spec,
    queries: { ...spec.queries, ...additions.queries },
    ...(hasActions ? { actions: { ...spec.actions, ...additions.actions } } : {}),
  };
}

/** The copied widget as clipboard text. */
export const serializeCopiedWidget = (copied: CopiedWidget): string => JSON.stringify(copied, null, 2);

/** A copied widget read from clipboard text, if it is one. */
export function parseCopiedWidget(text: string): CopiedWidget | undefined {
  try {
    const parsed = copiedWidgetSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

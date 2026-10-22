import { z } from 'zod';
import { coreWidgetSchema, type CoreWidget, type CoreWidgetType } from '@fluid/shared';
import { humanize } from '../../views/fieldHeuristics';

// The options form of a widget is derived from its zod schema, so every widget
// type (and every option added to one) is editable without writing a form.

/** How an option is edited. `query`/`path` pick the data binding; `json` is the fallback for nested options. */
export type OptionKind = 'text' | 'field' | 'number' | 'boolean' | 'select' | 'query' | 'path' | 'json';

export interface OptionField {
  /** Dot path of the option in the widget, e.g. "xField" or "data.path". */
  key: string;
  label: string;
  kind: OptionKind;
  required: boolean;
  /** Allowed values of a `select`. */
  choices?: (string | number)[];
  min?: number;
  max?: number;
}

/** Form values, keyed by `OptionField.key`. */
export type OptionValues = Record<string, unknown>;

export type OptionsResult = { ok: true; widget: CoreWidget } | { ok: false; errors: Record<string, string> };

type JsonSchema = z.core.JSONSchema.BaseSchema;

// Placement is edited on the grid itself; the binding has its own fields.
const HIDDEN = new Set(['type', 'id', 'span', 'height', 'layout', 'data']);

const BINDING_FIELDS: OptionField[] = [
  { key: 'data.query', label: 'Query', kind: 'query', required: true },
  { key: 'data.path', label: 'Path', kind: 'path', required: false },
  { key: 'data.transform', label: 'Transform', kind: 'json', required: false },
];

const isSafeBound = (n: unknown): n is number => typeof n === 'number' && Math.abs(n) < Number.MAX_SAFE_INTEGER;

function kindOf(key: string, schema: JsonSchema): Omit<OptionField, 'key' | 'label' | 'required'> {
  if (schema.enum) return { kind: 'select', choices: schema.enum as (string | number)[] };
  const consts = schema.anyOf?.map((s) => (s as JsonSchema).const);
  if (consts?.length && consts.every((c) => typeof c === 'string' || typeof c === 'number')) {
    return { kind: 'select', choices: consts as (string | number)[] };
  }
  if (schema.type === 'string') return { kind: /(^f|F)ield$/.test(key) ? 'field' : 'text' };
  if (schema.type === 'boolean') return { kind: 'boolean' };
  if (schema.type === 'integer' || schema.type === 'number') {
    const exclusive = schema.exclusiveMinimum;
    const low = schema.minimum ?? (isSafeBound(exclusive) ? exclusive + 1 : undefined);
    return { kind: 'number', min: low, max: isSafeBound(schema.maximum) ? schema.maximum : undefined };
  }
  return { kind: 'json' };
}

const cache = new Map<CoreWidgetType, OptionField[]>();

/** The editable options of a widget type: title first, then its own options, nested ones last. */
export function widgetOptions(type: CoreWidgetType): OptionField[] {
  const cached = cache.get(type);
  if (cached) return cached;
  const member = coreWidgetSchema.options.find((m) => m.shape.type.value === type)!;
  const json = z.toJSONSchema(member, { io: 'input' }) as JsonSchema;
  const required = new Set(json.required ?? []);
  const own = Object.entries(json.properties ?? {})
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, schema]): OptionField => ({
      key,
      label: humanize(key),
      required: required.has(key),
      ...kindOf(key, schema as JsonSchema),
    }));
  const rank = (f: OptionField) => (f.key === 'title' ? 0 : f.kind === 'json' ? 3 : f.required ? 1 : 2);
  const fields = [...BINDING_FIELDS, ...own.sort((a, b) => rank(a) - rank(b))];
  cache.set(type, fields);
  return fields;
}

function getAt(widget: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], widget);
}

/** Copy of `obj` with `key` (a dot path) set, or removed when `value` is undefined. */
function setAt(obj: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = key.split('.');
  const next = { ...obj };
  if (rest.length > 0) next[head] = setAt((obj[head] as Record<string, unknown>) ?? {}, rest.join('.'), value);
  else if (value === undefined) delete next[head];
  else next[head] = value;
  return next;
}

/** The form values showing a widget's options. */
export function toFormValues(widget: CoreWidget, fields: OptionField[]): OptionValues {
  const values: OptionValues = {};
  for (const field of fields) {
    const value = getAt(widget, field.key);
    values[field.key] = field.kind === 'json' ? (value === undefined ? '' : JSON.stringify(value, null, 2)) : value;
  }
  return values;
}

/** Applies form values to a widget, validated against the widget schema. */
export function fromFormValues(widget: CoreWidget, values: OptionValues, fields: OptionField[]): OptionsResult {
  const errors: Record<string, string> = {};
  let next: Record<string, unknown> = widget;
  for (const field of fields) {
    const raw = values[field.key];
    let value: unknown = raw === '' || raw === null ? undefined : raw;
    if (value === undefined && field.required) {
      errors[field.key] = 'Required';
      continue;
    }
    if (field.kind === 'json' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        errors[field.key] = 'Invalid JSON';
        continue;
      }
    }
    next = setAt(next, field.key, value);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = coreWidgetSchema.safeParse(next);
  if (parsed.success) return { ok: true, widget: parsed.data };
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    const field = fields.find((f) => path === f.key || path.startsWith(`${f.key}.`));
    const key = field?.key ?? '';
    errors[key] ??= field && path !== field.key ? `${path.slice(field.key.length + 1)}: ${issue.message}` : issue.message;
  }
  return { ok: false, errors };
}

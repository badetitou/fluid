import { parseMutationDocument, type ActionSpec, type FormField, type FormInput } from '@fluid/shared';
import type { InputField } from '../../../graphql/introspection';
import { getPath } from '../../data';

// The form widget, the pure parts: which input type its action fills, the
// fields it edits, and the values it starts from and submits.

/** The named type of the variable the action fills with the whole `$form` (`UpdateTodoInput`). */
export function formInputType(action: ActionSpec | undefined): string | undefined {
  if (!action) return undefined;
  const variable = Object.entries(action.variables ?? {}).find(([, value]) => value === '$form')?.[0];
  const parsed = parseMutationDocument(action.mutation);
  if (!variable || !parsed.ok) return undefined;
  const type = parsed.document.variables.find((v) => v.name === variable)?.type;
  return type && !type.startsWith('[') ? type.replace(/!$/, '') : undefined;
}

const NUMBER_SCALARS = new Set(['Int', 'Float', 'BigInt', 'Long', 'Decimal']);
const DATE_SCALARS = /^(Date|DateTime|Instant|Timestamp)$/;

/** How an input field is edited, from its GraphQL type. */
export function inputKindOf(field: Pick<InputField, 'typeName' | 'typeKind'>): FormInput {
  if (field.typeName === 'Boolean') return 'boolean';
  if (NUMBER_SCALARS.has(field.typeName)) return 'number';
  if (DATE_SCALARS.test(field.typeName)) return 'date';
  return 'text';
}

/** The input fields a form can edit: scalars and enums, not lists nor nested input objects. */
const editable = (f: InputField) => !f.isList && (f.typeKind === 'SCALAR' || f.typeKind === 'ENUM');

/**
 * The fields of the form: those configured, completed with the input kind the
 * input type suggests, or every editable field of the input type.
 */
export function resolveFormFields(configured: FormField[] | undefined, input: InputField[] | undefined): FormField[] {
  const byName = new Map((input ?? []).map((f) => [f.name, f]));
  if (configured?.length) {
    return configured.map((f) => {
      const known = byName.get(f.key);
      return { ...f, input: f.input ?? (known ? inputKindOf(known) : 'text') };
    });
  }
  return (input ?? []).filter(editable).map((f) => ({ key: f.name, input: inputKindOf(f), required: f.required }));
}

/**
 * The starting value of each field: the bound object's, by field key. A switch
 * shown off is worth `false`, so it is submitted even when left untouched.
 */
export function initialValues(fields: FormField[], object: unknown): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      const value = getPath(object, f.key);
      return [f.key, f.input === 'boolean' ? (value ?? false) : value];
    }),
  );
}

/** The submitted `$form`: dot-path keys nested (`user.id` → `{ user: { id } }`), untouched fields left out. */
export function toFormValue(values: Record<string, unknown>, fields: FormField[] = []): Record<string, unknown> {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const field = byKey.get(key);
    const coerced = field?.input === 'number' && typeof value === 'string' ? Number(value) : value;
    const segments = key.split('.');
    let node = out;
    for (const segment of segments.slice(0, -1)) {
      node[segment] ??= {};
      node = node[segment] as Record<string, unknown>;
    }
    node[segments[segments.length - 1]] = coerced;
  }
  return out;
}

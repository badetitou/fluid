// References in the variables of an action, resolved when it runs:
// `$target` is the item acted upon (a row, the displayed object), `$form` the
// values the user entered; both take an optional dot path (`$target.user.id`).
// A string starting with `$$` is a literal string starting with `$`.

export const ACTION_REF_SOURCES = ['target', 'form'] as const;
export type ActionRefSource = (typeof ACTION_REF_SOURCES)[number];

export interface ActionRef {
  source: ActionRefSource;
  /** Dot path inside the source; undefined for the whole value. */
  path?: string;
}

const REF = /^\$(target|form)(?:\.([A-Za-z_][\w]*(?:\.[A-Za-z_0-9][\w]*)*))?$/;

/**
 * Read a variable value: a reference, a literal (a `$$…` string unescaped), or
 * an error for a string starting with `$` that is no known reference.
 */
export function parseActionRef(value: string): { ref: ActionRef } | { literal: string } | { error: string } {
  if (!value.startsWith('$')) return { literal: value };
  if (value.startsWith('$$')) return { literal: value.slice(1) };
  const match = REF.exec(value);
  if (!match) {
    return { error: `"${value}" is not a reference: use $target, $form, $target.<path> or $form.<path> ($$ for a literal $).` };
  }
  return { ref: { source: match[1] as ActionRefSource, ...(match[2] ? { path: match[2] } : {}) } };
}

/** Every malformed reference in a variable value (strings nested in objects and arrays included). */
export function refErrors(value: unknown, path: PropertyKey[] = []): { path: PropertyKey[]; message: string }[] {
  if (typeof value === 'string') {
    const parsed = parseActionRef(value);
    return 'error' in parsed ? [{ path, message: parsed.error }] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => refErrors(v, [...path, i]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => refErrors(v, [...path, k]));
  }
  return [];
}

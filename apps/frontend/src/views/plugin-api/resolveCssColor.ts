const VAR = /^var\(\s*(--[^,)\s]+)\s*(?:,\s*(.+))?\)$/;

/** Finds the value of a CSS variable without the DOM (e.g. from antd's theme tokens). */
export type CssVariableLookup = (name: string) => string | undefined;

/**
 * A color a canvas can parse: `var(--x, fallback)` is read from `lookup`, then
 * from the element's computed style (the document root by default), else the
 * fallback, else the input unchanged. Other values are returned as is.
 */
export function resolveCssColor(
  value: string,
  element?: Element,
  lookup?: CssVariableLookup,
): string {
  const match = VAR.exec(value.trim());
  if (!match) return value;
  const target =
    element ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  const read =
    lookup?.(match[1])?.trim() ||
    (target ? getComputedStyle(target).getPropertyValue(match[1]).trim() : '');
  if (read) return resolveCssColor(read, element, lookup);
  return match[2] ? resolveCssColor(match[2].trim(), element, lookup) : value;
}

/**
 * antd scopes its CSS variables to the app element, not the document root:
 * `--ant-color-warning` is read from the token `colorWarning` instead.
 */
export function antdTokenLookup(token: object): CssVariableLookup {
  return (name) => {
    if (!name.startsWith('--ant-')) return undefined;
    const key = name.slice(6).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    const value = (token as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  };
}

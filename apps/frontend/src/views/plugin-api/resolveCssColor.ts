const VAR = /^var\(\s*(--[^,)\s]+)\s*(?:,\s*(.+))?\)$/;

/**
 * A color a canvas can parse: `var(--x, fallback)` is read from the element's
 * computed style (the document root by default), else the fallback, else the
 * input unchanged. Other values are returned as is.
 */
export function resolveCssColor(value: string, element?: Element): string {
  const match = VAR.exec(value.trim());
  if (!match) return value;
  const target = element ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  const read = target ? getComputedStyle(target).getPropertyValue(match[1]).trim() : '';
  if (read) return resolveCssColor(read, element);
  return match[2] ? resolveCssColor(match[2].trim(), element) : value;
}

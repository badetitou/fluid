import type { Column, FormatKind } from '@fluid/shared';
import { getPath } from '../data';

// Pure logic of the table widget: column inference, sorting and filtering.

export type Row = Record<string, unknown>;

/** Above this many distinct values, a column offers no value filter (it would be unusable). */
export const MAX_FILTER_OPTIONS = 100;

/** Page sizes offered by a table's size changer. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [8, 10, 20, 50, 100];

/** Options for the size changer: the spec's own size is always available. */
export function pageSizeOptions(specPageSize?: number): number[] {
  if (specPageSize == null || PAGE_SIZE_OPTIONS.includes(specPageSize)) return [...PAGE_SIZE_OPTIONS];
  return [...PAGE_SIZE_OPTIONS, specPageSize].sort((a, b) => a - b);
}

/** Keep a controlled page number in range when the rows or the page size change. */
export function clampPage(page: number, totalRows: number, pageSize: number): number {
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  return Math.min(Math.max(1, page), pages);
}

// Formats whose values are categories worth picking from a list. Numbers, dates
// and images are sorted, not filtered by value.
const FILTERABLE_FORMATS: ReadonlySet<FormatKind> = new Set(['text', 'tag', 'boolean']);

export function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function inferColumns(rows: Row[]): Column[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first)
    .filter((key) => {
      const value = first[key];
      return value == null || typeof value !== 'object';
    })
    .map((key) => ({ key, title: humanize(key) }));
}

/** The text a cell value is filtered on: nested lists are joined, empty values give "". */
export function filterText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(filterText).filter(Boolean).join(', ');
  return String(value);
}

function sortKey(value: unknown): number | string | null {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) return value.length === 0 ? null : sortKey(value[0]);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
}

/** Order two cell values: numbers numerically, text naturally ("a2" < "a10"); empty values last. */
export function compareValues(a: unknown, b: unknown): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
  if (typeof ka === 'number' && typeof kb === 'number') return ka - kb;
  return String(ka).localeCompare(String(kb), undefined, { numeric: true, sensitivity: 'base' });
}

/** Comparator on the value at `key` of two rows. */
export function compareRows(key: string): (a: Row, b: Row) => number {
  return (a, b) => compareValues(getPath(a, key), getPath(b, key));
}

/**
 * The values a column can be filtered by, sorted; `null` when the column should
 * offer no filter (numeric/date format, or too many distinct values).
 */
export function filterOptions(rows: Row[], column: Column): string[] | null {
  if (column.format && !FILTERABLE_FORMATS.has(column.format)) return null;
  const values = new Set<string>();
  for (const row of rows) {
    const value = getPath(row, column.key);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item != null && typeof item === 'object') return null;
      values.add(filterText(item));
      if (values.size > MAX_FILTER_OPTIONS) return null;
    }
  }
  if (values.size < 2) return null;
  return [...values].sort(compareValues);
}

/** Whether a row's value at `key` matches a selected filter option. */
export function matchesFilter(row: Row, key: string, option: string): boolean {
  const value = getPath(row, key);
  const items = Array.isArray(value) ? value : [value];
  return items.some((item) => filterText(item) === option);
}

import type { Aggregation, DataBinding, Transform } from '@fluid/shared';

// Runtime helpers that turn raw GraphQL results into the shapes widgets expect:
// dot-path selection, grouping/aggregation, sorting and limiting.

/** Resolve a dot path (e.g. "customer.fullName") against a value. */
export function getPath(obj: unknown, path?: string): unknown {
  if (path == null || path === '') return obj;
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type AggOp = Aggregation['op'];

/** Aggregate an array (or single value) into a scalar. */
export function aggregate(data: unknown, op: AggOp, field?: string): number | string | null {
  const rows = Array.isArray(data) ? data : data == null ? [] : [data];

  if (op === 'count') return rows.length;

  if (op === 'first') {
    const first = rows[0];
    const value = field ? getPath(first, field) : first;
    return value == null ? null : (value as number | string);
  }

  const numbers = rows
    .map((row) => (field ? getPath(row, field) : row))
    .map(toFiniteNumber)
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) return 0;

  switch (op) {
    case 'sum':
      return numbers.reduce((a, b) => a + b, 0);
    case 'avg':
      return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return 0;
  }
}

interface GroupAggregateRow {
  [key: string]: string | number;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

function groupRows(rows: unknown[], groupBy: string, field?: string): GroupAggregateRow[] {
  const groups = new Map<string, unknown[]>();
  for (const row of rows) {
    const raw = getPath(row, groupBy);
    const key = raw == null || raw === '' ? 'Unknown' : String(raw);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const out: GroupAggregateRow[] = [];
  for (const [key, bucket] of groups) {
    const numbers = field
      ? bucket
          .map((row) => toFiniteNumber(getPath(row, field)))
          .filter((n): n is number => n !== null)
      : [];
    const sum = numbers.reduce((a, b) => a + b, 0);
    out.push({
      [groupBy]: key,
      count: bucket.length,
      sum,
      avg: numbers.length ? sum / numbers.length : 0,
      min: numbers.length ? Math.min(...numbers) : 0,
      max: numbers.length ? Math.max(...numbers) : 0,
    });
  }
  return out;
}

function compareValues(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  let result: number;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else {
    result = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
  }
  return dir === 'desc' ? -result : result;
}

/** Apply a transform (group / aggregate / sort / limit) to array data. Non-arrays pass through. */
export function applyTransform(data: unknown, transform?: Transform): unknown {
  if (!Array.isArray(data)) return data;
  let rows: unknown[] = data;

  if (transform?.groupBy) {
    rows = groupRows(rows, transform.groupBy, transform.aggregate?.field);
  }

  if (transform?.sort) {
    const { by, dir } = transform.sort;
    rows = [...rows].sort((a, b) => compareValues(getPath(a, by), getPath(b, by), dir));
  }

  if (transform?.limit != null) {
    rows = rows.slice(0, transform.limit);
  }

  return rows;
}

/** Resolve a widget's data binding against the set of query results. */
export function resolveBinding(
  binding: DataBinding,
  results: Record<string, unknown>,
): unknown {
  const root = results[binding.query];
  const picked = getPath(root, binding.path);
  return applyTransform(picked, binding.transform);
}

/** Coerce a resolved binding into an array (widgets that iterate rows). */
export function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value == null) return [];
  return [value as Record<string, unknown>];
}

/** Coerce a resolved binding into a single object (descriptions widget). */
export function asObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (value != null && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

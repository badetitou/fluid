import type { AnalyzeViewRequest, DataBinding, InsightSource, InsightWidget, ViewSpec, Widget } from '@fluid/shared';

// What the insight widget sends to the analyst: the data each source widget
// shows, compacted so that the request stays small (rows sampled, long texts
// cut, deep nesting summarised), and a key identifying the request.

/** Upper bound on the JSON sent for all sources together. */
export const INSIGHT_BUDGET = 40_000;
const ROW_STEPS = [60, 30, 15, 8, 4];
const NESTED_ROWS = 8;
const MAX_TEXT = 240;
const MAX_DEPTH = 4;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A JSON-friendly copy of `value`: lists cut to `rows` items (nested ones shorter), texts and depth bounded. */
export function compactValue(value: unknown, rows: number, depth = 0): unknown {
  if (typeof value === 'string') return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[${value.length} items]`;
    const limit = depth === 0 ? rows : Math.min(rows, NESTED_ROWS);
    const kept = value.slice(0, limit).map((v) => compactValue(v, rows, depth + 1));
    return value.length > limit ? [...kept, `… ${value.length - limit} more`] : kept;
  }
  if (isRecord(value)) {
    if (depth >= MAX_DEPTH) return '{…}';
    const entries = Object.entries(value).filter(([k, v]) => k !== '__typename' && v !== undefined);
    return Object.fromEntries(entries.map(([k, v]) => [k, compactValue(v, rows, depth + 1)]));
  }
  return undefined;
}

const bindingOf = (widget: Widget): DataBinding | undefined => {
  const data = (widget as { data?: unknown }).data;
  return isRecord(data) && typeof data.query === 'string' ? (data as DataBinding) : undefined;
};

/** The widgets the insight widget reads: its `sources`, or every other non-insight widget of the view. */
export function sourceWidgets(view: ViewSpec, self: InsightWidget): Widget[] {
  const wanted = self.sources ? new Set(self.sources) : null;
  return view.widgets.filter(
    (w) => w.id !== self.id && w.type !== 'insight' && (wanted ? wanted.has(w.id) : true) && bindingOf(w),
  );
}

const AGGREGATES = ['sum', 'avg', 'min', 'max'];

/**
 * The data a binding shows. A `groupBy` without `aggregate.field` gives every group
 * `sum`, `avg`, `min`, `max` of 0: zeros that would mislead the analyst, dropped.
 */
function shownData(binding: DataBinding, resolve: (b: DataBinding) => unknown): unknown {
  const value = resolve(binding);
  const t = binding.transform;
  if (!t?.groupBy || t.aggregate || !Array.isArray(value)) return value;
  return value.map((row) =>
    isRecord(row) ? Object.fromEntries(Object.entries(row).filter(([k]) => !AGGREGATES.includes(k))) : row,
  );
}

interface RawSource {
  id: string;
  type: string;
  title?: string;
  value: unknown;
}

/** The data each source shows, resolved; sources without data yet (e.g. an empty selection) are left out. */
function rawSources(view: ViewSpec, self: InsightWidget, resolve: (b: DataBinding) => unknown): RawSource[] {
  const sources: RawSource[] = sourceWidgets(view, self).map((w) => ({
    id: w.id,
    type: w.type,
    title: w.title,
    value: shownData(bindingOf(w)!, resolve),
  }));
  if (self.data) sources.push({ id: self.id, type: 'data', title: 'Extra data', value: shownData(self.data, resolve) });
  return sources.filter((s) => s.value !== undefined && s.value !== null);
}

/** Compacts every source, sampling fewer rows until the whole fits in `budget`. */
export function compactSources(raw: RawSource[], budget = INSIGHT_BUDGET): InsightSource[] {
  let compacted: InsightSource[] = [];
  for (const rows of ROW_STEPS) {
    compacted = raw.map(({ value, ...s }) => ({
      ...s,
      ...(Array.isArray(value) ? { rowCount: value.length } : {}),
      data: compactValue(value, rows),
    }));
    if (JSON.stringify(compacted).length <= budget) break;
  }
  return compacted;
}

/** The request analysing `view` for the insight widget `self`, or null when no source has data. */
export function buildInsightRequest(
  view: ViewSpec,
  self: InsightWidget,
  resolve: (binding: DataBinding) => unknown,
): AnalyzeViewRequest | null {
  const sources = compactSources(rawSources(view, self, resolve));
  if (sources.length === 0) return null;
  return {
    view: { title: view.title, concept: view.concept, description: view.description },
    focus: self.focus,
    sources,
  };
}

/** A short, stable key of a request (FNV-1a over its JSON), to cache its analysis. */
export function insightKey(request: AnalyzeViewRequest): string {
  const text = JSON.stringify(request);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}-${text.length}`;
}

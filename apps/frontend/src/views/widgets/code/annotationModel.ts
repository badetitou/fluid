import type { CodeAnnotations } from '@fluid/shared';
import { getPath } from '../../data';
import { SEVERITY_RANK } from '../../plugin-api/decorationModel';

// Pure logic of the code widget's annotations: rows coming from the data
// (linter results, critiques…) turned into line/column ranges of the source.

export type Severity = 'error' | 'warning' | 'info';

/** An annotation on the shown source. Lines and columns are 1-based; `endColumn` is exclusive. */
export interface Annotation {
  line: number;
  endLine: number;
  /** Absent: the annotation covers whole lines. */
  column?: number;
  endColumn?: number;
  message: string;
  severity: Severity;
  rule?: string;
}

const ERROR = /^(error|err|fatal|critical|blocker|high|severe|failure|failed)$/i;
const WARNING = /^(warn|warning|medium|major|moderate)$/i;

/** error / warning / info, from the many words APIs use for it. */
export function normalizeSeverity(value: unknown): Severity {
  const word = String(value ?? '').trim();
  if (ERROR.test(word)) return 'error';
  if (WARNING.test(word)) return 'warning';
  if (/^\d+$/.test(word)) return Number(word) >= 2 ? 'error' : Number(word) === 1 ? 'warning' : 'info';
  return 'info';
}

// Imported from the file, not the plugin-api barrel: the barrel reaches the widget catalog, hence this file (cycle).
/** The most severe of a list (info when empty: an annotation without a severity is informative). */
export function worstSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>((worst, s) => (SEVERITY_RANK[s] < SEVERITY_RANK[worst] ? s : worst), 'info');
}

const toNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** 1-based line and column of a 0-based character offset. */
export function positionOf(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, Math.max(0, offset)).replace(/\r\n?/g, '\n');
  const lastBreak = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: before.length - lastBreak };
}

export type Range = Pick<Annotation, 'line' | 'endLine' | 'column' | 'endColumn'>;

/** The position fields of an annotation spec or of a rules spec. */
export type PositionFields = Pick<
  CodeAnnotations,
  | 'lineField'
  | 'endLineField'
  | 'columnField'
  | 'endColumnField'
  | 'startOffsetField'
  | 'endOffsetField'
  | 'offsetBase'
>;

function rangeFromOffsets(row: unknown, spec: PositionFields, source: string): Range | undefined {
  const base = spec.offsetBase ?? 0;
  const start = toNumber(getPath(row, spec.startOffsetField));
  if (start == null) return undefined;
  const rawEnd = spec.endOffsetField ? toNumber(getPath(row, spec.endOffsetField)) : undefined;
  // A 1-based inclusive interval [start, stop] is the 0-based half-open [start - 1, stop).
  const from = start - base;
  const to = rawEnd ?? from + 1;
  const a = positionOf(source, from);
  const b = positionOf(source, Math.max(to, from + 1) - 1);
  return { line: a.line, endLine: b.line, column: a.column, endColumn: b.column + 1 };
}

function rangeFromLines(row: unknown, spec: PositionFields): Range | undefined {
  const line = toNumber(getPath(row, spec.lineField));
  if (line == null) return undefined;
  const endLine = toNumber(getPath(row, spec.endLineField)) ?? line;
  const column = spec.columnField ? toNumber(getPath(row, spec.columnField)) : undefined;
  const endColumn = spec.endColumnField ? toNumber(getPath(row, spec.endColumnField)) : undefined;
  return { line, endLine: Math.max(line, endLine), column, endColumn: column == null ? undefined : endColumn };
}

/** The range of a row in the source (offsets when `startOffsetField` is set, else lines); undefined without a position. */
export function readPosition(row: unknown, fields: PositionFields, source: string): Range | undefined {
  return fields.startOffsetField ? rangeFromOffsets(row, fields, source) : rangeFromLines(row, fields);
}

/** The annotations of a source, from the rows the spec points at. Rows without a position are dropped. */
export function readAnnotations(rows: unknown[], spec: CodeAnnotations, source: string): Annotation[] {
  return rows.flatMap((row) => {
    const range = readPosition(row, spec, source);
    if (!range) return [];
    const rule = spec.ruleField ? getPath(row, spec.ruleField) : undefined;
    return [
      {
        ...range,
        message: String(getPath(row, spec.messageField) ?? ''),
        severity: normalizeSeverity(spec.severityField ? getPath(row, spec.severityField) : undefined),
        rule: rule == null || rule === '' ? undefined : String(rule),
      },
    ];
  });
}

/** Annotations starting on a line, most severe first: their messages are shown under it. */
export function annotationsByLine(annotations: Annotation[]): Map<number, Annotation[]> {
  const byLine = new Map<number, Annotation[]>();
  const sorted = [...annotations].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  for (const a of sorted) byLine.set(a.line, [...(byLine.get(a.line) ?? []), a]);
  return byLine;
}

/** Number of annotations per severity. */
export function severityCounts(annotations: Annotation[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const a of annotations) counts[a.severity]++;
  return counts;
}

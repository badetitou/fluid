import type { Annotation, Severity } from './annotationModel';

// Pure logic of what is marked inside a line of code: search hits, highlighted
// terms and annotation ranges, cut into segments over the syntax tokens.

export type MarkKind = 'match' | 'current' | 'term' | Severity;

/** A marked character range of one line, 0-based, `end` exclusive. */
export interface Mark {
  start: number;
  end: number;
  kind: MarkKind;
  title?: string;
}

/** A search hit: the row it is in and its range. */
export interface Match {
  row: number;
  start: number;
  end: number;
}

/** Ranges of `term` in `text`, case-insensitive, without overlaps. */
export function findAll(text: string, term: string): { start: number; end: number }[] {
  if (!term) return [];
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase();
  const found: { start: number; end: number }[] = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    found.push({ start: at, end: at + needle.length });
  }
  return found;
}

/** Every hit of a search over the rows' texts, in reading order. */
export function searchRows(texts: string[], query: string): Match[] {
  return texts.flatMap((text, row) => findAll(text, query).map((r) => ({ row, ...r })));
}

/** The part of an annotation that falls on a line (whole line when it has no columns). */
export function annotationMark(a: Annotation, lineNo: number, lineLength: number): Mark | undefined {
  if (lineNo < a.line || lineNo > a.endLine) return undefined;
  const start = lineNo === a.line && a.column != null ? a.column - 1 : 0;
  const end = lineNo === a.endLine && a.endColumn != null ? a.endColumn - 1 : lineLength;
  const title = a.rule ? `${a.rule}: ${a.message}` : a.message;
  return { start: Math.max(0, start), end: Math.max(start + 1, Math.min(end, lineLength)), kind: a.severity, title };
}

/** Everything marked on a row: highlighted terms, its search hits, the annotations covering its line. */
export function rowMarks(
  text: string,
  lineNo: number | undefined,
  marked: { terms: string[]; hits: Match[]; current?: Match; annotations: Annotation[] },
): Mark[] {
  const terms = marked.terms.flatMap((t) => findAll(text, t).map((r): Mark => ({ ...r, kind: 'term' })));
  const hits = marked.hits.map((h): Mark => ({ start: h.start, end: h.end, kind: h === marked.current ? 'current' : 'match' }));
  const notes =
    lineNo == null ? [] : marked.annotations.flatMap((a) => annotationMark(a, lineNo, text.length) ?? []);
  return [...notes, ...terms, ...hits];
}

/** Marks drawn over others when ranges overlap: the search is on top. */
const LAYER: Record<MarkKind, number> = { info: 0, warning: 1, error: 2, term: 3, match: 4, current: 5 };

/** A piece of a syntax token, with the marks that cover it. */
export interface Segment {
  types: string[];
  content: string;
  marks: Mark[];
}

/**
 * Cuts a line's tokens wherever a mark starts or ends, so every segment keeps
 * its syntax types and knows which marks cover it (topmost last).
 */
export function segmentLine(tokens: { types: string[]; content: string }[], marks: Mark[]): Segment[] {
  if (marks.length === 0) return tokens.map((t) => ({ ...t, marks: [] }));
  const sorted = [...marks].sort((a, b) => LAYER[a.kind] - LAYER[b.kind]);
  const cuts = new Set(marks.flatMap((m) => [m.start, m.end]));
  const segments: Segment[] = [];
  let offset = 0;
  for (const token of tokens) {
    const end = offset + token.content.length;
    const inner = [...cuts].filter((c) => c > offset && c < end).sort((a, b) => a - b);
    let from = offset;
    for (const to of [...inner, end]) {
      if (to > from) {
        const covering = sorted.filter((m) => m.start < to && m.end > from);
        segments.push({ types: token.types, content: token.content.slice(from - offset, to - offset), marks: covering });
      }
      from = to;
    }
    offset = end;
  }
  return segments;
}

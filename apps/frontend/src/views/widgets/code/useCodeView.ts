import { useMemo, useState } from 'react';
import type { CodeWidget, DataBinding } from '@fluid/shared';
import { readCodeSources } from './codeModel';
import { diffRows, diffStats, foldRows, plainRows, type CodeRow, type RowItem } from './diffModel';
import { annotationsByLine, readAnnotations, severityCounts, type Annotation, type Severity } from './annotationModel';
import { rowMarks, type Mark, type Match } from './markModel';
import { useCodeSearch, type CodeSearch } from './useCodeSearch';
import { useRuleAnnotations } from './useRuleAnnotations';

export interface CodeView {
  source: string;
  rows: CodeRow[];
  /** Rows to draw, unchanged runs of a diff folded. */
  items: RowItem[];
  isDiff: boolean;
  stats: { added: number; removed: number };
  annotations: Annotation[];
  /** Annotations by the line they start at: their messages go under it. */
  messages: Map<number, Annotation[]>;
  counts: Record<Severity, number>;
  search: CodeSearch;
  marksOf: (index: number) => Mark[];
  unfold: (from: number, to: number) => void;
}

const DEFAULT_CONTEXT = 3;

/** Everything the code widget draws: rows (or diff), annotations, search, folds. */
export function useCodeView(widget: CodeWidget, data: unknown, resolve: (b: DataBinding) => unknown): CodeView {
  const { source, before, annotationRows } = readCodeSources(widget, data, resolve);
  const isDiff = before != null;
  const rows = useMemo(() => (before != null ? diffRows(before, source) : plainRows(source)), [before, source]);
  const texts = useMemo(() => rows.map((r) => r.text), [rows]);
  const search = useCodeSearch(texts);
  const [unfolded, setUnfolded] = useState<ReadonlySet<number>>(new Set());

  const dataAnnotations = useMemo(
    () => (widget.annotations ? readAnnotations(annotationRows, widget.annotations, source) : []),
    // The rows are a fresh array on every render: compare their content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(annotationRows), widget.annotations, source],
  );
  const ruleAnnotations = useRuleAnnotations(widget.rules, resolve, source);
  const annotations = useMemo(
    () => (ruleAnnotations.length === 0 ? dataAnnotations : [...dataAnnotations, ...ruleAnnotations]),
    [dataAnnotations, ruleAnnotations],
  );
  const messages = useMemo(() => annotationsByLine(annotations), [annotations]);

  const items = useMemo((): RowItem[] => {
    if (!isDiff || search.query) return rows.map((r, index) => ({ ...r, index }));
    const keep = (r: CodeRow, i: number) => unfolded.has(i) || (r.newNo != null && messages.has(r.newNo));
    return foldRows(rows, widget.context ?? DEFAULT_CONTEXT, keep);
  }, [isDiff, search.query, rows, unfolded, messages, widget.context]);

  const hitsByRow = useMemo(() => {
    const byRow = new Map<number, Match[]>();
    for (const m of search.matches) byRow.set(m.row, [...(byRow.get(m.row) ?? []), m]);
    return byRow;
  }, [search.matches]);

  const marksOf = (index: number) =>
    rowMarks(rows[index].text, rows[index].newNo, {
      terms: widget.highlight ?? [],
      hits: hitsByRow.get(index) ?? [],
      current: search.current,
      annotations,
    });

  return {
    source,
    rows,
    items,
    isDiff,
    stats: diffStats(rows),
    annotations,
    messages,
    counts: severityCounts(annotations),
    search,
    marksOf,
    unfold: (from, to) =>
      setUnfolded((s) => new Set([...s, ...Array.from({ length: to - from }, (_, k) => from + k)])),
  };
}

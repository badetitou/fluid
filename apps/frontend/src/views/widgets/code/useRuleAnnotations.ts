import { useMemo } from 'react';
import type { CodeRules, DataBinding } from '@fluid/shared';
import { useDecorations } from '../../plugin-api/decorations';
import type { Annotation } from './annotationModel';
import { astRowsToGraph, findingsToAnnotations } from './astDecorations';

const NONE: Annotation[] = [];

/** The findings of the active graph decorators on the syntax tree of the source, as annotations. */
export function useRuleAnnotations(
  rules: CodeRules | undefined,
  resolve: (b: DataBinding) => unknown,
  source: string,
): Annotation[] {
  const resolved = rules ? resolve(rules.data) : undefined;
  // The rows are a fresh array on every render: compare their content.
  const rows = useMemo(
    () => (resolved == null ? [] : Array.isArray(resolved) ? resolved : [resolved]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(resolved)],
  );
  const graph = useMemo(() => (rules && rows.length > 0 ? astRowsToGraph(rows, rules) : undefined), [rules, rows]);
  const index = useDecorations(graph);
  return useMemo(
    () => (rules && index.nodes.size > 0 ? findingsToAnnotations(index, rows, rules, source) : NONE),
    [index, rows, rules, source],
  );
}

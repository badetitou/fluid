import { useCallback, useMemo, useState } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../graphql/introspection';
import { buildDetailView } from '../../views/registry';
import type { ColumnKind } from '../../views/viewScope';
import { columnEntries, injectItemId, resolveActiveKey } from './model';
import { useViews, type ViewEntry } from './useViews';

export interface ColumnPerspectives {
  /** Perspectives offered in this column, in pill order. */
  entries: ViewEntry[];
  /** The perspective shown, if any. */
  selected: ViewEntry | undefined;
  /** The selected spec with the drilled-in item id injected. */
  spec: ViewSpec | null;
  columnKind: ColumnKind;
  loading: boolean;
  bffAvailable: boolean;
  pick: (key: string | undefined) => void;
  refetch: () => void;
}

interface Options {
  /** Present for drill-in (detail) columns. */
  itemId?: string;
  /** Introspected related concepts, used to link relations in the detail perspective. */
  conceptByName: Map<string, Concept>;
  queriesByType: Map<string, ConceptQueries>;
}

/**
 * The perspectives (saved / curated / auto views) of one Miller column and the
 * one currently shown. A detail column also gets an auto detail perspective,
 * bound to the by-id query, as its default.
 */
export function useColumnPerspectives(
  concept: Concept,
  { itemId, conceptByName, queriesByType }: Options,
): ColumnPerspectives {
  const views = useViews(concept);
  // The pick is remembered per concept so a new concept starts on its default.
  const [picked, setPicked] = useState<{ concept: string; key?: string }>({ concept: concept.name });
  const columnKind: ColumnKind = itemId ? 'detail' : 'list';
  const byIdField = concept.queries.byId?.field;

  const detailEntry = useMemo<ViewEntry | null>(() => {
    if (!itemId) return null;
    const detailSpec = buildDetailView(concept, { conceptByName, queriesByType });
    return detailSpec
      ? { key: detailSpec.id, title: `${concept.name} detail`, source: 'auto', spec: detailSpec }
      : null;
  }, [itemId, concept, conceptByName, queriesByType]);

  const entries = useMemo(
    () => columnEntries(views.entries, columnKind, byIdField, detailEntry),
    [views.entries, columnKind, byIdField, detailEntry],
  );

  const pickedKey = picked.concept === concept.name ? picked.key : undefined;
  const activeKey = resolveActiveKey(entries, pickedKey, itemId ? detailEntry?.key : views.defaultKey);
  const selected = entries.find((e) => e.key === activeKey);

  const spec = useMemo(
    () => (selected ? injectItemId(selected.spec, byIdField, itemId) : null),
    [selected, byIdField, itemId],
  );

  const pick = useCallback((key: string | undefined) => setPicked({ concept: concept.name, key }), [concept.name]);

  return {
    entries,
    selected,
    spec,
    columnKind,
    loading: views.loading,
    bffAvailable: views.bffAvailable,
    pick,
    refetch: views.refetch,
  };
}

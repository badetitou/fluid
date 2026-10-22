import { useCallback, useMemo, useState } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../graphql/introspection';
import { buildDetailView, buildTreeView, withEditForm } from '../../views/registry';
import { useSourceWrites } from '../preferences/useSourceWrites';
import type { ColumnKind } from '../../views/viewScope';
import { columnEntries, injectItemId, resolveActiveKey } from './model';
import { usePerspectiveMemory } from './perspectiveMemory';
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
  /** Position of the column: the perspective last picked there is shown first. */
  slot?: string;
  /** Perspective shown first, when listed (e.g. a saved dashboard's). */
  initialKey?: string;
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
  { itemId, slot, initialKey, conceptByName, queriesByType }: Options,
): ColumnPerspectives {
  const views = useViews(concept);
  const remember = usePerspectiveMemory((s) => s.remember);
  // The pick is remembered per concept so a new concept starts on its default,
  // and per slot so a column reopened at the same place starts on its last one.
  const [picked, setPicked] = useState<{ concept: string; key?: string }>(() => ({
    concept: concept.name,
    key: initialKey ?? (slot === undefined ? undefined : usePerspectiveMemory.getState().bySlot[slot]),
  }));
  const columnKind: ColumnKind = itemId ? 'detail' : 'list';
  const byIdField = concept.queries.byId?.field;
  // Where the source accepts writes, the auto detail also edits the item.
  const { writable } = useSourceWrites();

  const detailEntry = useMemo<ViewEntry | null>(() => {
    if (!itemId) return null;
    const built = buildDetailView(concept, { conceptByName, queriesByType });
    const detailSpec = built && writable ? withEditForm(built, concept) : built;
    return detailSpec
      ? { key: detailSpec.id, title: `${concept.name} detail`, source: 'auto', spec: detailSpec }
      : null;
  }, [itemId, concept, conceptByName, queriesByType, writable]);

  // Concepts whose data forms a hierarchy also get a tree perspective in list columns.
  const treeEntry = useMemo<ViewEntry | null>(() => {
    if (itemId) return null;
    const treeSpec = buildTreeView(concept, { conceptByName, queriesByType });
    return treeSpec ? { key: treeSpec.id, title: treeSpec.title, source: 'auto', spec: treeSpec } : null;
  }, [itemId, concept, conceptByName, queriesByType]);

  const entries = useMemo(
    () => columnEntries(treeEntry ? [...views.entries, treeEntry] : views.entries, columnKind, byIdField, detailEntry),
    [views.entries, treeEntry, columnKind, byIdField, detailEntry],
  );

  const pickedKey = picked.concept === concept.name ? picked.key : undefined;
  const activeKey = resolveActiveKey(entries, pickedKey, itemId ? detailEntry?.key : views.defaultKey);
  const selected = entries.find((e) => e.key === activeKey);

  const spec = useMemo(
    () => (selected ? injectItemId(selected.spec, byIdField, itemId) : null),
    [selected, byIdField, itemId],
  );

  const pick = useCallback(
    (key: string | undefined) => {
      setPicked({ concept: concept.name, key });
      if (slot !== undefined) remember(slot, key);
    },
    [concept.name, slot, remember],
  );

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

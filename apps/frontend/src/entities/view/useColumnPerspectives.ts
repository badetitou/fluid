import { useCallback, useMemo, useState } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { Concept, ConceptQueries } from '../../graphql/introspection';
import type { RootFields } from '../plugin';
import { useSourceWrites } from '../preferences/useSourceWrites';
import type { ColumnKind } from '../../views/viewScope';
import { columnEntries, injectItemId, perspectiveEntries, resolveActiveKey } from './model';
import { usePerspectiveMemory } from './perspectiveMemory';
import { useBuilderPerspectives } from './useBuilderPerspectives';
import { useViews, type ViewEntry } from './useViews';
import { splitHidden, useViewVisibility } from './viewVisibility';

export interface ColumnPerspectives {
  /** Perspectives offered in this column, in pill order. */
  entries: ViewEntry[];
  /** Perspectives the user hid from the pills, to be shown again from the menu. */
  hidden: ViewEntry[];
  /** The perspective shown, if any. */
  selected: ViewEntry | undefined;
  /** The selected spec with the drilled-in item id injected. */
  spec: ViewSpec | null;
  columnKind: ColumnKind;
  loading: boolean;
  bffAvailable: boolean;
  pick: (key: string | undefined) => void;
  hide: (key: string) => void;
  /** Shows a hidden perspective again, and selects it. */
  show: (key: string) => void;
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
  /** The source's root query fields, once introspected (see `ViewBuilderContext.rootFields`). */
  rootFields?: RootFields;
}

/**
 * The perspectives of one Miller column — the saved views, then those the
 * view builder plugins propose (curated, auto, remote) — and the one shown.
 * A perspective a builder makes the default of this kind of column (the auto
 * detail of a drilled-in item) comes first and is shown by default.
 */
export function useColumnPerspectives(
  concept: Concept,
  { itemId, slot, initialKey, conceptByName, queriesByType, rootFields }: Options,
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

  const proposed = useBuilderPerspectives({ concept, columnKind, itemId, conceptByName, queriesByType, writable, rootFields });
  const built = useMemo(() => perspectiveEntries(proposed, columnKind), [proposed, columnKind]);

  const all = useMemo(
    () => columnEntries([...views.entries, ...built.others], columnKind, byIdField, built.preferred ?? null),
    [views.entries, built, columnKind, byIdField],
  );
  // Hidden perspectives leave the pills: the active one falls back to a visible one.
  const visibility = useViewVisibility(concept.name, columnKind);
  const { visible: entries, hidden } = useMemo(() => splitHidden(all, visibility.hiddenKeys), [all, visibility.hiddenKeys]);

  const pickedKey = picked.concept === concept.name ? picked.key : undefined;
  const activeKey = resolveActiveKey(entries, pickedKey, built.preferred?.key ?? views.defaultKey);
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
  const { show: unhide } = visibility;
  const show = useCallback(
    (key: string) => {
      unhide(key);
      pick(key);
    },
    [unhide, pick],
  );

  return {
    entries,
    hidden,
    selected,
    spec,
    columnKind,
    loading: views.loading,
    bffAvailable: views.bffAvailable,
    pick,
    hide: visibility.hide,
    show,
    refetch: views.refetch,
  };
}

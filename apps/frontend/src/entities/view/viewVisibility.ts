import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useConnection } from '../../store';

interface HiddenViewsState {
  /** Inspector scope (source, concept, list or detail) -> keys of the perspectives hidden there. */
  byScope: Record<string, string[]>;
  setHidden: (scope: string, key: string, hidden: boolean) => void;
}

/**
 * Perspectives the user hid from an inspector's pills; they stay listed in its
 * "…" menu to be shown again.
 */
export const useHiddenViews = create<HiddenViewsState>()(
  persist(
    (set) => ({
      byScope: {},
      setHidden: (scope, key, hidden) =>
        set((s) => ({ byScope: withHidden(s.byScope, scope, key, hidden) })),
    }),
    { name: 'fluid-hidden-views' },
  ),
);

/** Where hidden perspectives are remembered: per source, concept and kind of column. */
export function hiddenViewsScope(graphqlUrl: string | null, concept: string, columnKind: string): string {
  return `${graphqlUrl ?? ''}|${concept}|${columnKind}`;
}

/** `byScope` with `key` hidden (or shown again) in `scope`; empty scopes are dropped. */
export function withHidden(
  byScope: Record<string, string[]>,
  scope: string,
  key: string,
  hidden: boolean,
): Record<string, string[]> {
  const current = byScope[scope] ?? [];
  if (current.includes(key) === hidden) return byScope;
  const next = hidden ? [...current, key] : current.filter((k) => k !== key);
  const { [scope]: _previous, ...rest } = byScope;
  return next.length > 0 ? { ...rest, [scope]: next } : rest;
}

/** Splits entries into those shown as pills and those the user hid, keeping their order. */
export function splitHidden<T extends { key: string }>(entries: T[], hiddenKeys: readonly string[]) {
  const hidden = new Set(hiddenKeys);
  return {
    visible: entries.filter((e) => !hidden.has(e.key)),
    hidden: entries.filter((e) => hidden.has(e.key)),
  };
}

const NONE: string[] = [];

/** The keys hidden in one inspector, and how to hide or show a perspective there. */
export function useViewVisibility(concept: string, columnKind: string) {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const scope = hiddenViewsScope(graphqlUrl, concept, columnKind);
  const hiddenKeys = useHiddenViews((s) => s.byScope[scope]) ?? NONE;
  const setHidden = useHiddenViews((s) => s.setHidden);
  const hide = useCallback((key: string) => setHidden(scope, key, true), [scope, setHidden]);
  const show = useCallback((key: string) => setHidden(scope, key, false), [scope, setHidden]);
  return { hiddenKeys, hide, show };
}

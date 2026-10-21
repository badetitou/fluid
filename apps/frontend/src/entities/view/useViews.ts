import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXAMPLE_VIEWS, type ViewSpec } from '@fluid/shared';
import type { Concept } from '../../graphql/introspection';
import { buildDefaultView } from '../../views/registry';
import { bffClient, type SavedView } from '../../bff/client';

export type ViewSource = 'saved' | 'curated' | 'auto';

export interface ViewEntry {
  /** Stable selection key: DB id for saved views, spec id for curated/auto. */
  key: string;
  title: string;
  source: ViewSource;
  spec: ViewSpec;
  /** Present only when the entry is persisted in the BFF. */
  saved?: SavedView;
}

export interface UseViewsResult {
  entries: ViewEntry[];
  defaultKey: string | undefined;
  loading: boolean;
  /** False once a BFF request has failed — the UI degrades to curated/auto only. */
  bffAvailable: boolean;
  refetch: () => void;
}

/**
 * Resolves every view available for a concept, merging persisted views from the
 * BFF with the curated examples and the auto-generated overview. Stays usable
 * when the BFF is unreachable (saved list is simply empty).
 */
export function useViews(concept: Concept | undefined): UseViewsResult {
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [bffAvailable, setBffAvailable] = useState(true);
  const [nonce, setNonce] = useState(0);

  const conceptName = concept?.name;

  useEffect(() => {
    if (!conceptName) {
      setSaved([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    bffClient
      .listViews(conceptName)
      .then((rows) => {
        if (cancelled) return;
        setSaved(rows);
        setBffAvailable(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSaved([]);
        setBffAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conceptName, nonce]);

  const entries = useMemo<ViewEntry[]>(() => {
    if (!concept) return [];
    const list: ViewEntry[] = [];
    for (const v of saved) {
      list.push({ key: v.id, title: v.title, source: 'saved', spec: v.spec, saved: v });
    }
    for (const c of EXAMPLE_VIEWS[concept.name] ?? []) {
      list.push({ key: c.id, title: c.title, source: 'curated', spec: c });
    }
    const auto = buildDefaultView(concept);
    if (auto) list.push({ key: auto.id, title: auto.title, source: 'auto', spec: auto });
    return list;
  }, [saved, concept]);

  const defaultKey = useMemo(() => {
    const def = saved.find((v) => v.isDefault);
    return def ? def.id : entries[0]?.key;
  }, [saved, entries]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { entries, defaultKey, loading, bffAvailable, refetch };
}

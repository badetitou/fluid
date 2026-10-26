import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { Concept } from '../../graphql/introspection';
import { bffClient, type SavedView } from '../../bff/client';

/**
 * How a perspective was made: saved in the BFF, proposed by a view builder
 * plugin (curated, auto, or remote — asked to another backend), or `draft`:
 * being created, not persisted yet.
 */
export type ViewSource = 'saved' | 'curated' | 'auto' | 'remote' | 'draft';

export interface ViewEntry {
  /** Stable selection key: DB id for saved views, spec id for curated/auto. */
  key: string;
  title: string;
  source: ViewSource;
  spec: ViewSpec;
  /** Present only when the entry is persisted in the BFF. */
  saved?: SavedView;
  /** Shown first, and by default, in columns of this kind (a builder said so). */
  defaultFor?: 'list' | 'detail';
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
 * The views saved in the BFF for a concept (view builder plugins propose the
 * others, see `useBuilderPerspectives`). Stays usable when the BFF is
 * unreachable (the list is simply empty).
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

  const entries = useMemo<ViewEntry[]>(
    () => (concept ? saved.map((v) => ({ key: v.id, title: v.title, source: 'saved', spec: v.spec, saved: v })) : []),
    [saved, concept],
  );

  const defaultKey = useMemo(() => saved.find((v) => v.isDefault)?.id, [saved]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { entries, defaultKey, loading, bffAvailable, refetch };
}

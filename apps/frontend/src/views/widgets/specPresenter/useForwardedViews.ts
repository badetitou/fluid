import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewDeclaration, ViewRef } from '@fluid/shared';
import { parseOpenView, type OpenViewDocument } from './parseView';
import type { OpenViewSource } from './sourceModel';

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The views a `forward` node shows, by priority: the one it names, else all the views of its object. */
export function useForwardedViews(
  source: OpenViewSource | undefined,
  ref: ViewRef,
  view: string | undefined,
): { views?: ViewDeclaration[]; error?: string } {
  const [answer, setAnswer] = useState<{ views?: ViewDeclaration[]; error?: string }>({});
  const { id, type } = ref;
  useEffect(() => {
    if (!source || view) return;
    let cancelled = false;
    source.views({ id, type }).then(
      (res) => !cancelled && setAnswer({ views: [...res.views].sort((a, b) => a.priority - b.priority) }),
      (err: unknown) => !cancelled && setAnswer({ error: message(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [source, id, type, view]);
  return view ? { views: [{ key: view, title: view, priority: 0 }] } : answer;
}

/** One view loaded from `source` (a forwarded one), and how to load it again. */
export function useLoadedView(source: OpenViewSource): {
  doc?: OpenViewDocument;
  error?: string;
  reload: () => Promise<void>;
} {
  const [answer, setAnswer] = useState<{ value?: unknown; error?: string }>();
  const reload = useCallback(
    () => source.reload().then((value) => setAnswer({ value }), (err: unknown) => setAnswer({ error: message(err) })),
    [source],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  const parsed = useMemo(() => (answer && !answer.error ? parseOpenView(answer.value) : undefined), [answer]);
  return { doc: parsed?.doc, error: answer?.error ?? parsed?.reason, reload };
}

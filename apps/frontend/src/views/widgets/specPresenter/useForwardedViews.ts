import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewDeclaration, ViewRef } from '@fluid/shared';
import { parseOpenView, type OpenViewDocument } from './parseView';
import type { OpenViewSource } from './sourceModel';

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

interface ViewsAnswer {
  views?: ViewDeclaration[];
  error?: string;
}

/**
 * The views a `forward` node shows, by priority: the one it names, else all the
 * views of its object. Nothing is fetched without a source (then `{}`).
 */
export function useForwardedViews(source: OpenViewSource | undefined, ref: ViewRef, view: string | undefined): ViewsAnswer {
  // The answer, with the request it answers: a change of target never shows the previous one.
  const [answer, setAnswer] = useState<{ source: OpenViewSource; target: string; value: ViewsAnswer }>();
  const { id, type } = ref;
  const target = `${type ?? ''}#${id}`;
  useEffect(() => {
    if (!source || view) return;
    let cancelled = false;
    const settle = (value: ViewsAnswer) => !cancelled && setAnswer({ source, target, value });
    source.views({ id, type }).then(
      (res) => settle({ views: [...res.views].sort((a, b) => a.priority - b.priority) }),
      (err: unknown) => settle({ error: message(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [source, id, type, target, view]);
  if (view) return { views: [{ key: view, title: view, priority: 0 }] };
  return answer && answer.source === source && answer.target === target ? answer.value : {};
}

/** One view loaded from `source` (a forwarded one), and how to load it again. */
export function useLoadedView(source: OpenViewSource): {
  doc?: OpenViewDocument;
  error?: string;
  reload: () => Promise<void>;
} {
  // The answer, with the source it came from: a change of source never shows the previous view.
  const [answer, setAnswer] = useState<{ source: OpenViewSource; value?: unknown; error?: string }>();
  // Bumped on every load and when the source changes: only the latest load is kept.
  const latest = useRef(0);
  const reload = useCallback(() => {
    const request = ++latest.current;
    const settle = (value: { value?: unknown; error?: string }) => {
      if (request === latest.current) setAnswer({ source, ...value });
    };
    return source.reload().then(
      (value) => settle({ value }),
      (err: unknown) => settle({ error: message(err) }),
    );
  }, [source]);
  useEffect(() => {
    void reload();
    return () => {
      latest.current += 1;
    };
  }, [reload]);
  const current = answer?.source === source ? answer : undefined;
  const parsed = useMemo(() => (current && !current.error ? parseOpenView(current.value) : undefined), [current]);
  return { doc: parsed?.doc, error: current?.error ?? parsed?.reason, reload };
}

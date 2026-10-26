import { useEffect, useMemo, useState } from 'react';
import { useActiveViewBuilders, type Perspective, type ViewBuilderContext } from '../plugin';

type ColumnContext = Omit<ViewBuilderContext, 'settings'>;

/**
 * The perspectives the enabled view builders propose for a column, in plugin
 * order: those built from the column at once, those asked to a backend as
 * they arrive (a builder that fails proposes nothing).
 */
export function useBuilderPerspectives(context: ColumnContext): Perspective[] {
  const builders = useActiveViewBuilders();
  const { concept, columnKind, itemId, conceptByName, queriesByType, writable } = context;

  const built = useMemo(
    () =>
      builders.map(({ builder, settings }) =>
        builder.perspectives?.({ concept, columnKind, itemId, conceptByName, queriesByType, writable, settings }) ?? [],
      ),
    [builders, concept, columnKind, itemId, conceptByName, queriesByType, writable],
  );

  // Fetched perspectives, by builder id, for the column they were fetched for.
  const [fetched, setFetched] = useState<{ for: unknown; byBuilder: Record<string, Perspective[]> }>({ for: null, byBuilder: {} });
  const columnKey = useMemo(() => ({ builders, concept, columnKind, itemId }), [builders, concept, columnKind, itemId]);

  useEffect(() => {
    const controller = new AbortController();
    for (const { builder, settings } of builders) {
      if (!builder.fetchPerspectives) continue;
      builder
        .fetchPerspectives({ concept, columnKind, itemId, conceptByName, queriesByType, writable, settings }, controller.signal)
        .then((list) => {
          if (controller.signal.aborted) return;
          setFetched((f) => ({ for: columnKey, byBuilder: { ...(f.for === columnKey ? f.byBuilder : {}), [builder.id]: list } }));
        })
        .catch(() => undefined);
    }
    return () => controller.abort();
  }, [columnKey, builders, concept, columnKind, itemId, conceptByName, queriesByType, writable]);

  return useMemo(() => {
    const byBuilder = fetched.for === columnKey ? fetched.byBuilder : {};
    return builders.flatMap(({ builder }, i) => [...built[i], ...(byBuilder[builder.id] ?? [])]);
  }, [builders, built, fetched, columnKey]);
}

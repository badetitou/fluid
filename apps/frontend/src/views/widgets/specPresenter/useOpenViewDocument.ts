import { useCallback, useMemo, useState } from 'react';
import type { DataBinding } from '@fluid/shared';
import { resolveBinding } from '../../data';
import { parseOpenView, type ParsedOpenView } from './parseView';
import type { OpenViewSource } from './sourceModel';

interface OpenViewDocument {
  parsed: ParsedOpenView;
  /** Loads the view again from its source (a `refresh` action); undefined without a source. */
  reload?: () => Promise<void>;
}

/**
 * The view the widget draws: `data` as the view resolved it, replaced by a
 * fresher answer once `reload` ran, until `data` itself changes.
 */
export function useOpenViewDocument(
  binding: DataBinding | undefined,
  data: unknown,
  source: OpenViewSource | undefined,
): OpenViewDocument {
  const [reloaded, setReloaded] = useState<{ from: unknown; value: unknown }>();
  const current = reloaded && reloaded.from === data ? reloaded.value : data;
  const parsed = useMemo(() => parseOpenView(current), [current]);
  const reload = useCallback(async () => {
    if (!source || !binding) return;
    const answer = await source.reload();
    setReloaded({ from: data, value: resolveBinding(binding, { [binding.query]: answer }) });
  }, [source, binding, data]);
  return { parsed, reload: source && binding ? reload : undefined };
}

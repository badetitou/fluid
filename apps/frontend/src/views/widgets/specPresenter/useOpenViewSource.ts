import { useMemo } from 'react';
import type { DataBinding } from '@fluid/shared';
import { useDataSources } from '../../plugin-api/dataSources';
import { useRenderedView } from '../../plugin-api/viewContext';
import { openViewSource, type OpenViewSource } from './sourceModel';

/**
 * The data source the widget's `data` binding reads, ready to page items, run
 * actions and follow `forward` nodes. Undefined when the bound query is not
 * run by a data source (then the view is drawn as it came, read-only).
 */
export function useOpenViewSource(binding: DataBinding | undefined): OpenViewSource | undefined {
  const view = useRenderedView();
  const sources = useDataSources();
  const query = binding ? view?.queries[binding.query] : undefined;
  return useMemo(() => {
    const source = query?.source ? sources.get(query.source) : undefined;
    if (!query || !source) return undefined;
    return openViewSource(source, query.query, (query.variables ?? {}) as Record<string, unknown>);
  }, [query, sources]);
}

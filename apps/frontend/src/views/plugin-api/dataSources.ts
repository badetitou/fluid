import { createContext, useContext } from 'react';

/**
 * A backend other than the GraphQL source, provided by a view builder plugin.
 * A view's query naming it in `source` is run by it instead of urql: it gets
 * the query's `query` and `variables` and answers the query's `data`.
 */
export interface DataSource {
  id: string;
  /** Other ids it answers for (e.g. of a builder it replaced), unless a data source has that id. */
  aliases?: readonly string[];
  run: (query: string, variables: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

/** The data sources of the active plugins, by id. Empty without a provider. */
export const DataSourcesContext = createContext<ReadonlyMap<string, DataSource>>(new Map());

export function useDataSources(): ReadonlyMap<string, DataSource> {
  return useContext(DataSourcesContext);
}

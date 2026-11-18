import { useMemo } from 'react';
import { BFF_URL } from '../../runtime-config';
import { useConnection } from '../../store';
import { resolveGraphqlEndpoint } from './model';
import { useSavedSources } from './store';

/** The URL GraphQL requests go to: the connected source's, or the BFF's proxy when it is routed through it. */
export function useGraphqlEndpoint(): string | null {
  const url = useConnection((s) => s.graphqlUrl);
  const saved = useSavedSources((s) => s.saved);
  return useMemo(() => (url ? resolveGraphqlEndpoint(url, saved, BFF_URL) : null), [url, saved]);
}

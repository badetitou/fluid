import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClient, useQuery } from 'urql';
import {
  ROOT_TYPE_QUERY,
  buildConcept,
  buildRootQueries,
  buildWrapperTypesQuery,
  findWrapperCandidates,
  typeQuery,
  type Concept,
  type IntrospectionDepth,
  type ConceptQueries,
  type IntrospectionType,
  type RootTypeResult,
  type TypeResult,
} from '../graphql/introspection';
import { useConnection, usePinnedConcepts } from '../store';

export type { Concept };

const EMPTY_PINNED: string[] = [];

export interface ConceptEntry {
  name: string;
  /** True for concepts reached from the root Query, false for user-pinned ones. */
  isRoot: boolean;
  queries: ConceptQueries;
}

export interface UseRootConceptsResult {
  /** Root concepts first (sorted), then pinned deeper concepts in pin order. */
  concepts: ConceptEntry[];
  queriesByType: Map<string, ConceptQueries>;
  /** Introspection depth this source accepts (see `IntrospectionDepth`). */
  depth: IntrospectionDepth;
  fetching: boolean;
  error?: Error;
  reexecute: () => void;
}

/**
 * Introspects only the root Query type: the concept bar lists the object types
 * it returns, plus the concepts the user pinned for this source. Each concept's
 * own fields are loaded on demand with `useConcept`. Root fields that may return
 * a pagination wrapper (`characters: Characters { info, results }`) get their
 * wrapper type introspected too, in one aliased query, so the wrapper's rows
 * become the item concept's list query.
 *
 * The root type is first introspected deeply; a source rejecting that query
 * (e.g. a depth limit) switches every introspection of this source to shallow.
 */
export function useRootConcepts(): UseRootConceptsResult {
  const [rootResult, reexecuteRoot] = useQuery<RootTypeResult>({ query: ROOT_TYPE_QUERY });
  const rootTypeName = rootResult.data?.__schema.queryType?.name;

  const [deepResult, reexecuteDeep] = useQuery<TypeResult>({
    query: typeQuery('deep'),
    variables: { name: rootTypeName ?? '' },
    pause: !rootTypeName,
  });
  const depth: IntrospectionDepth = deepResult.error ? 'shallow' : 'deep';
  const [shallowResult, reexecuteShallow] = useQuery<TypeResult>({
    query: typeQuery('shallow'),
    variables: { name: rootTypeName ?? '' },
    pause: !rootTypeName || depth === 'deep',
  });
  const typeResult = depth === 'deep' ? deepResult : shallowResult;
  const reexecuteType = depth === 'deep' ? reexecuteDeep : reexecuteShallow;

  const rootType = typeResult.data?.__type ?? null;
  const wrapperNames = useMemo(() => [...findWrapperCandidates(rootType).keys()], [rootType]);
  const wrappersQuery = useMemo(
    () => buildWrapperTypesQuery(wrapperNames, depth),
    [wrapperNames, depth],
  );
  const [wrappersResult, reexecuteWrappers] = useQuery<Record<string, IntrospectionType | null>>({
    query: wrappersQuery ?? ROOT_TYPE_QUERY,
    pause: !wrappersQuery,
  });

  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const pinned = usePinnedConcepts((s) => (graphqlUrl ? s.byUrl[graphqlUrl] : undefined)) ?? EMPTY_PINNED;

  const queriesByType = useMemo(() => {
    const wrappers = new Map<string, IntrospectionType>();
    for (const t of Object.values(wrappersResult.data ?? {})) {
      if (t?.name) wrappers.set(t.name, t);
    }
    return buildRootQueries(rootType, wrappers).queriesByType;
  }, [rootType, wrappersResult.data]);

  const concepts = useMemo<ConceptEntry[]>(() => {
    const roots = [...queriesByType.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, isRoot: true, queries: queriesByType.get(name) ?? {} }));
    const extras = pinned
      .filter((name) => !queriesByType.has(name))
      .map((name) => ({ name, isRoot: false, queries: {} }));
    return [...roots, ...extras];
  }, [queriesByType, pinned]);

  return {
    concepts,
    queriesByType,
    depth,
    fetching:
      rootResult.fetching ||
      typeResult.fetching ||
      wrappersResult.fetching ||
      (Boolean(rootTypeName) && !typeResult.data && !typeResult.error) ||
      (Boolean(wrappersQuery) && !wrappersResult.data && !wrappersResult.error),
    // A failed wrapper lookup only loses the paginated list queries: not fatal.
    error: rootResult.error ?? typeResult.error,
    reexecute: () => {
      reexecuteRoot({ requestPolicy: 'network-only' });
      reexecuteType({ requestPolicy: 'network-only' });
      if (wrappersQuery) reexecuteWrappers({ requestPolicy: 'network-only' });
    },
  };
}

export interface UseConceptResult {
  /** Undefined while loading, null when the name is not an explorable object type. */
  concept: Concept | null | undefined;
  fetching: boolean;
  error?: Error;
}

/** Introspects a single concept's type on demand (cached by urql per type name). */
export function useConcept(name: string | undefined): UseConceptResult {
  const { queriesByType, depth, fetching: rootFetching, error: rootError } = useRootConcepts();
  // Wait for the root so the source's accepted depth is known.
  const [result] = useQuery<TypeResult>({
    query: typeQuery(depth),
    variables: { name: name ?? '' },
    pause: !name || rootFetching,
  });

  const queries = name ? queriesByType.get(name) : undefined;
  const concept = useMemo(() => {
    if (!name || rootFetching || !result.data) return undefined;
    return buildConcept(result.data.__type, queries);
  }, [name, rootFetching, result.data, queries]);

  return {
    concept,
    fetching: rootFetching || result.fetching,
    error: rootError ?? result.error,
  };
}

/**
 * Introspects a variable set of types (e.g. a concept's related types, to give
 * the LLM their fields). Uses the client imperatively so the hook count stays
 * fixed whatever the number of names; urql's cache dedupes repeated requests.
 */
export function useConceptsByName(names: string[]): Map<string, Concept> {
  const client = useClient();
  const { depth, fetching: rootFetching } = useRootConcepts();
  const [byName, setByName] = useState<Map<string, Concept>>(() => new Map());
  const key = useMemo(() => [...new Set(names)].sort().join(','), [names]);

  const load = useCallback(
    async (list: string[]) => {
      const results = await Promise.all(
        list.map((name) => client.query<TypeResult>(typeQuery(depth), { name }).toPromise()),
      );
      const map = new Map<string, Concept>();
      for (const r of results) {
        const concept = buildConcept(r.data?.__type ?? null);
        if (concept) map.set(concept.name, concept);
      }
      return map;
    },
    [client, depth],
  );

  useEffect(() => {
    if (rootFetching) return;
    let cancelled = false;
    const list = key ? key.split(',') : [];
    load(list).then((map) => {
      if (!cancelled) setByName(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key, load, rootFetching]);

  return byName;
}

/** Pin / unpin helpers bound to the current GraphQL source. */
export function usePinning() {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const pinned = usePinnedConcepts((s) => (graphqlUrl ? s.byUrl[graphqlUrl] : undefined)) ?? EMPTY_PINNED;
  const pinFn = usePinnedConcepts((s) => s.pin);
  const unpinFn = usePinnedConcepts((s) => s.unpin);
  const pin = useCallback(
    (name: string) => {
      if (graphqlUrl) pinFn(graphqlUrl, name);
    },
    [graphqlUrl, pinFn],
  );
  const unpin = useCallback(
    (name: string) => {
      if (graphqlUrl) unpinFn(graphqlUrl, name);
    },
    [graphqlUrl, unpinFn],
  );
  return { pinned, pin, unpin };
}

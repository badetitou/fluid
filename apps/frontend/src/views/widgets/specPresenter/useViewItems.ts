import { useCallback, useEffect, useState } from 'react';
import {
  appendPage,
  initialItems,
  itemsPath,
  loadAll,
  missingCount,
  needsChildren,
  withChildren,
  type ItemsLoader,
  type ItemsState,
  type PageableNode,
} from './itemsModel';

export interface ViewItems extends ItemsState {
  loading: boolean;
  error?: string;
  /** How many items exist that are not loaded yet. */
  missing: number;
  /** Loads the next page of items. */
  loadMore: () => void;
  /** Loads the children of a tree item announcing some (`key`: its item path), once. */
  expand: (key: string) => void;
}

const NO_SOURCE = 'No data source to load the rest of the items from.';

/**
 * The items of a list or tree, completed through the items route: all of them
 * at once for a `lazy` node, the next page on `loadMore`, a tree item's
 * children on `expand`. `index` is the node's place among the pageable nodes.
 */
export function useViewItems(node: PageableNode, index: number | undefined, load: ItemsLoader | undefined): ViewItems {
  const [state, setState] = useState<ItemsState>(() => initialItems(node));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const run = useCallback(
    (task: (load: ItemsLoader, index: number) => Promise<(s: ItemsState) => ItemsState>) => {
      if (!load || index === undefined) return setError(NO_SOURCE);
      setLoading(true);
      setError(undefined);
      task(load, index)
        .then((update) => setState(update))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
    },
    [load, index],
  );

  useEffect(() => {
    setState(initialItems(node));
    if (!node.lazy) return;
    run(async (l, i) => {
      const all = await loadAll(l, itemsPath(i));
      return () => all;
    });
  }, [node, run]);

  const loaded = state.items.length;
  const loadMore = useCallback(
    () =>
      run(async (l, i) => {
        const page = await l(itemsPath(i), loaded);
        return (s) => appendPage(s, page);
      }),
    [run, loaded],
  );
  const expand = useCallback(
    (key: string) => {
      if (!needsChildren(state.items, key)) return;
      run(async (l, i) => {
        const { items } = await loadAll(l, itemsPath(i, key));
        return (s) => ({ ...s, items: withChildren(s.items, key, items) });
      });
    },
    [run, state.items],
  );
  return { ...state, loading, error, missing: missingCount(state), loadMore, expand };
}

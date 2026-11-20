import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Bumped when the node changes (or the widget goes away): answers asked before are dropped.
  const generation = useRef(0);
  // Loads running for the current generation; `loading` until the last one ends.
  const pending = useRef(0);

  const run = useCallback(
    (task: (load: ItemsLoader, index: number) => Promise<(s: ItemsState) => ItemsState>) => {
      if (!load || index === undefined) return setError(NO_SOURCE);
      const started = generation.current;
      const current = () => generation.current === started;
      pending.current += 1;
      setLoading(true);
      setError(undefined);
      task(load, index)
        .then((update) => current() && setState(update))
        .catch((err: unknown) => current() && setError(err instanceof Error ? err.message : String(err)))
        .finally(() => {
          if (!current()) return;
          pending.current -= 1;
          if (pending.current === 0) setLoading(false);
        });
    },
    [load, index],
  );

  useEffect(() => {
    generation.current += 1;
    pending.current = 0;
    setState(initialItems(node));
    setLoading(false);
    setError(undefined);
    if (node.lazy) {
      run(async (l, i) => {
        const all = await loadAll(l, itemsPath(i));
        return () => all;
      });
    }
    return () => {
      generation.current += 1;
    };
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

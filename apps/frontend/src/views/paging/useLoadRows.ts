import { useCallback, useState } from 'react';
import { useRowPaging } from '../plugin-api/rowPaging';

type LoadRows = (kind: 'more' | 'all') => Promise<void>;

/** Loading more or all rows of one query, with the "load all" confirmation when the source asks for it. */
export function useLoadRows(load: LoadRows | undefined) {
  const { confirmLoadAll, stopConfirmingLoadAll } = useRowPaging();
  const [loading, setLoading] = useState<'more' | 'all' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = useCallback(
    async (kind: 'more' | 'all') => {
      if (!load) return;
      setLoading(kind);
      try {
        await load(kind);
      } finally {
        setLoading(null);
      }
    },
    [load],
  );

  const loadAll = useCallback(() => (confirmLoadAll ? setConfirming(true) : void run('all')), [confirmLoadAll, run]);
  const confirm = useCallback(
    (dontAskAgain: boolean) => {
      setConfirming(false);
      if (dontAskAgain) stopConfirmingLoadAll();
      void run('all');
    },
    [run, stopConfirmingLoadAll],
  );

  return {
    loading,
    loadMore: () => void run('more'),
    loadAll,
    dialog: { open: confirming, onConfirm: confirm, onCancel: () => setConfirming(false) },
  };
}

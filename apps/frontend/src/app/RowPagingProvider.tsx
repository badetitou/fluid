import { useMemo, type ReactNode } from 'react';
import { useSourceSettings } from '../entities/source';
import { RowPagingContext, type RowPagingContextValue } from '../views/plugin-api';

/** Gives the engine the row settings of the connected source (under the urql provider: it reads the schema). */
export function RowPagingProvider({ children }: { children: ReactNode }) {
  const { effective, offsetArg, update } = useSourceSettings();
  const value = useMemo<RowPagingContextValue>(
    () => ({
      rowLimit: effective.rowLimit,
      maxPerRequest: effective.maxPerRequest,
      offsetArg,
      confirmLoadAll: effective.confirmLoadAll,
      stopConfirmingLoadAll: () => update({ confirmLoadAll: false }),
    }),
    [effective, offsetArg, update],
  );
  return <RowPagingContext.Provider value={value}>{children}</RowPagingContext.Provider>;
}

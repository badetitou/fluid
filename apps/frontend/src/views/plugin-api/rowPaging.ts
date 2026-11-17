import { createContext, useContext } from 'react';
import type { RowPaging } from '../paging/model';

/** How the connected source pages its lists, and whether to ask before loading every row. */
export interface RowPagingContextValue extends RowPaging {
  /** Ask for a confirmation before "load all" (until "don't ask again"). */
  confirmLoadAll: boolean;
  /** "Don't ask again": load all without a confirmation from now on, for this source. */
  stopConfirmingLoadAll: () => void;
}

const NONE: RowPagingContextValue = { confirmLoadAll: true, stopConfirmingLoadAll: () => {} };

/** Provided by the app from the source settings; without a provider, the views' own `take`. */
export const RowPagingContext = createContext<RowPagingContextValue>(NONE);

export function useRowPaging(): RowPagingContextValue {
  return useContext(RowPagingContext);
}

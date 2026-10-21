import { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { appendColumn } from './millerPath';

/**
 * The path of the column a widget is rendered in (e.g.
 * `/d/Character/Character@1`). Links append to it, so following a link
 * from any column — not only the last one — replaces the columns to its right.
 */
export const MillerColumnPathContext = createContext<string | null>(null);

/** Href that opens `concept` (one item when `id` is given) in a new column right after the current one. */
export function useNavigationHref(): (concept: string, id?: string) => string {
  const columnPath = useContext(MillerColumnPathContext);
  const { pathname } = useLocation();
  const base = columnPath ?? pathname;
  return (concept, id) => appendColumn(base, { concept, itemId: id });
}

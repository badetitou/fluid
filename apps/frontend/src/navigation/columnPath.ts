import { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The Miller path of the column a widget is rendered in (e.g.
 * `/miller/Character/Character/1`). Links append to it, so following a link
 * from any column — not only the last one — replaces the columns to its right.
 */
export const MillerColumnPathContext = createContext<string | null>(null);

/** Href that opens `concept`/`id` in a new column right after the current one. */
export function useNavigationHref(): (concept: string, id: string) => string {
  const columnPath = useContext(MillerColumnPathContext);
  const { pathname } = useLocation();
  const base = (columnPath ?? pathname).replace(/\/$/, '');
  return (concept, id) => `${base}/${concept}/${encodeURIComponent(id)}`;
}

import { createContext, useCallback, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import type { LinkTo } from '@fluid/shared';
import { getNavigationId, linkTargetConcept } from './linkExtractor';
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

/**
 * Concepts that can be opened on one item (they have a by-id query). Links
 * declared on an interface open the item's concrete type when it is one of them.
 */
export const OpenableConceptsContext = createContext<ReadonlySet<string> | null>(null);

/** Href opening the item a row links to (in its concrete type), when the row has its id. */
export function useLinkHref(): (row: Record<string, unknown>, linkTo?: LinkTo) => string | undefined {
  const hrefFor = useNavigationHref();
  const openable = useContext(OpenableConceptsContext);
  return useCallback(
    (row, linkTo) => {
      const id = linkTo ? getNavigationId(row, linkTo.idField ?? 'id') : undefined;
      if (!linkTo || !id) return undefined;
      return hrefFor(linkTargetConcept(row, linkTo, (c) => openable?.has(c) ?? false), id);
    },
    [hrefFor, openable],
  );
}

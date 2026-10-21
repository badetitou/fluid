/**
 * Link Extractor Utility
 * Extracts navigation links from widget configurations based on linkTo definitions.
 * This enables automatic discovery of navigation targets from GraphQL schema metadata.
 */

import type { Column, DescriptionsWidget, TableWidget } from '@fluid/shared';

export interface NavigationLink {
  /** The concept/entity type to navigate to */
  targetConcept: string;
  /** The field path to extract the ID value from the data row */
  idField: string;
  /** Column key (for table widgets) or item key (for description widgets) */
  sourceKey: string;
}

/**
 * Extract navigation links from a table widget configuration.
 * Returns a map of column keys to their navigation targets.
 */
export function extractTableLinks(widget: TableWidget): Map<string, NavigationLink> {
  const links = new Map<string, NavigationLink>();

  if (!widget.columns) {
    return links;
  }

  widget.columns.forEach((col: Column) => {
    if (col.linkTo) {
      links.set(col.key, {
        targetConcept: col.linkTo.concept,
        idField: col.linkTo.idField ?? 'id',
        sourceKey: col.key,
      });
    }
  });

  return links;
}

/**
 * Extract navigation links from a descriptions widget configuration.
 * Returns a map of item keys to their navigation targets.
 */
export function extractDescriptionLinks(widget: DescriptionsWidget): Map<string, NavigationLink> {
  const links = new Map<string, NavigationLink>();

  widget.items.forEach((item) => {
    if (item.linkTo) {
      links.set(item.key, {
        targetConcept: item.linkTo.concept,
        idField: item.linkTo.idField ?? 'id',
        sourceKey: item.key,
      });
    }
  });

  return links;
}

/**
 * Get a nested value from an object using dot notation path.
 * Handles deeply nested properties and array indices safely.
 *
 * @example
 * getNestedValue({ customer: { id: '123' } }, 'customer.id') // '123'
 * getNestedValue({ accounts: [{ id: 'A1' }] }, 'accounts[0].id') // 'A1'
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (current, prop) =>
        current != null && typeof current === 'object' ? (current as Record<string, unknown>)[prop] : undefined,
      obj,
    );
}

/**
 * Build a navigation URL for the Miller List view
 */
export function buildMillerNavigationUrl(
  basePathname: string,
  targetConcept: string,
  itemId: string,
): string {
  // If already in a miller path, append to it
  if (basePathname.startsWith('/miller')) {
    return `${basePathname}/${targetConcept}/${itemId}`;
  }

  // Otherwise, start a new miller view from the target concept
  return `/miller/${targetConcept}/${targetConcept}/${itemId}`;
}

/**
 * Build a navigation URL for a regular concept item view
 */
export function buildConceptNavigationUrl(
  targetConcept: string,
  itemId: string,
): string {
  return `/concept/${targetConcept}/item/${itemId}`;
}

/**
 * Check if a row has a valid navigation target for a given link configuration.
 * Returns the ID value if valid, undefined otherwise.
 */
export function getNavigationId(row: Record<string, unknown>, idFieldPath: string): string | undefined {
  const idValue = getNestedValue(row, idFieldPath);

  if (idValue === null || idValue === undefined || idValue === '') {
    return undefined;
  }

  return String(idValue);
}

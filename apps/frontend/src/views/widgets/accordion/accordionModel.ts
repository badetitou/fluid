import { ACCORDION_ITEM_QUERY, type AccordionWidget, type DataBinding } from '@fluid/shared';
import { asRows, getPath, resolveBinding } from '../../data';
import { nodeLabel } from '../tree/treeModel';

export type Row = Record<string, unknown>;

export interface Panel {
  key: string;
  label: string;
  row: Row;
}

export const DEFAULT_PAGE_SIZE = 20;
/** Below this width a nested widget is too cramped: it takes the panel's whole row. */
export const MIN_NESTED_WIDTH = 240;

/** One panel per element of the collection, keyed by `keyField` (else by position, made unique). */
export function buildPanels(data: unknown, keyField = 'id', labelField?: string): Panel[] {
  const seen = new Set<string>();
  return asRows(data).map((row, index) => {
    const value = row != null && typeof row === 'object' ? getPath(row, keyField) : undefined;
    let key = value == null || typeof value === 'object' ? `#${index}` : String(value);
    if (seen.has(key)) key = `${key}#${index}`;
    seen.add(key);
    return { key, label: row != null && typeof row === 'object' ? nodeLabel(row, labelField) : String(row), row };
  });
}

/** The panels unfolded on first render. */
export function initialOpenKeys(panels: Panel[], expanded: AccordionWidget['expanded'] = 'none'): string[] {
  if (expanded === 'all') return panels.map((p) => p.key);
  if (expanded === 'first') return panels.slice(0, 1).map((p) => p.key);
  return [];
}

/** The panels of a 1-based page. */
export function pageOf(panels: Panel[], page: number, pageSize = DEFAULT_PAGE_SIZE): Panel[] {
  return panels.slice((page - 1) * pageSize, page * pageSize);
}

/**
 * A nested widget's width on Ant's 24-column grid, from the panel's width (not
 * the screen's: the accordion may sit in a narrow column): its `span`, but
 * never narrower than `MIN_NESTED_WIDTH`, and full-width when two do not fit.
 */
export function nestedSpan(span: number | undefined, panelWidth: number): number {
  const fit = Math.floor(panelWidth / MIN_NESTED_WIDTH);
  return fit < 2 ? 24 : Math.max(Math.ceil(24 / fit), Math.min(24, span ?? 24));
}

/**
 * The resolver of the widgets nested in a panel: `$item` bindings read the
 * panel's element, every other binding goes to the enclosing resolver (the
 * view's queries, or the element of an enclosing accordion).
 */
export function itemResolver(
  item: unknown,
  parent: (binding: DataBinding) => unknown,
): (binding: DataBinding) => unknown {
  return (binding) =>
    binding.query === ACCORDION_ITEM_QUERY ? resolveBinding(binding, { [ACCORDION_ITEM_QUERY]: item }) : parent(binding);
}

import { createContext, useContext } from 'react';
import { builtinWidgetCatalog } from '../widgets/catalog';
import type { WidgetCatalog, WidgetRendererDefinition } from './types';

/** The active widget catalog. Without a provider (tests, previews), the built-in widgets. */
export const WidgetCatalogContext = createContext<WidgetCatalog | null>(null);

export function useWidgetCatalog(): WidgetCatalog {
  return useContext(WidgetCatalogContext) ?? builtinWidgetCatalog();
}

/** The renderer of a widget type, or undefined when no active plugin provides it. */
export function useWidgetRenderer(type: string): WidgetRendererDefinition | undefined {
  return useWidgetCatalog().renderers.get(type);
}

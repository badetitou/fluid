import type { ViewSpec, Widget } from '@fluid/shared';
import { replaceWidget, viewUpdate, type ViewChanges, type ViewRecord } from './model';
import type { ViewRepository } from './repository';

// Saved views, independent of any transport (HTTP routes today, the MCP server next).
// Inputs are already validated (zod at the edge); "not found" is a result, not an exception.

export type WidgetUpdateResult = { view: ViewRecord } | { missing: 'view' | 'widget' };

export interface ViewService {
  list(concept?: string): Promise<ViewRecord[]>;
  get(id: string): Promise<ViewRecord | null>;
  create(spec: ViewSpec, isDefault?: boolean): Promise<ViewRecord>;
  update(id: string, changes: ViewChanges): Promise<ViewRecord | null>;
  /** Replaces one widget of a view, keeping its id and place on the grid. */
  updateWidget(id: string, widgetId: string, widget: Widget): Promise<WidgetUpdateResult>;
  remove(id: string): Promise<boolean>;
}

export function createViewService(views: ViewRepository): ViewService {
  return {
    list: (concept) => views.list(concept),
    get: (id) => views.get(id),
    create: (spec, isDefault = false) => views.create({ concept: spec.concept, title: spec.title, spec, isDefault }),
    async update(id, changes) {
      const existing = await views.get(id);
      if (!existing) return null;
      return views.update(id, viewUpdate(existing, changes), changes.spec?.concept ?? existing.concept);
    },
    async updateWidget(id, widgetId, widget) {
      const existing = await views.get(id);
      if (!existing) return { missing: 'view' };
      const spec = replaceWidget(existing.spec, widgetId, widget);
      if (!spec) return { missing: 'widget' };
      const view = await views.update(id, { spec }, existing.concept);
      return view ? { view } : { missing: 'view' };
    },
    remove: (id) => views.remove(id),
  };
}

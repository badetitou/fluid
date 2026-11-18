import { z } from 'zod';
import type { ViewSpec, Widget } from '@fluid/shared';

// Pure rules of saved views: what a rename or a widget replacement does to the stored spec.

/** A stored view as the API returns it (the spec is the JSON written, checked when it was saved). */
export interface ViewRecord {
  id: string;
  concept: string;
  title: string;
  spec: unknown;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** What a view is saved with; `concept` and `title` are denormalized from the spec for listing. */
export interface ViewData {
  concept: string;
  title: string;
  spec: unknown;
  isDefault: boolean;
}

export interface ViewChanges {
  spec?: ViewSpec;
  title?: string;
  isDefault?: boolean;
}

const storedSpec = z.looseObject({ widgets: z.array(z.looseObject({ id: z.string() })) });

/** The data to write for `changes`: a new spec wins; a bare rename also renames the stored spec. */
export function viewUpdate(existing: Pick<ViewRecord, 'spec'>, changes: ViewChanges): Partial<ViewData> {
  const { spec, title, isDefault } = changes;
  const out: Partial<ViewData> = {};
  if (spec) Object.assign(out, { spec, concept: spec.concept, title: spec.title });
  if (title) {
    out.title = title;
    if (!spec && typeof existing.spec === 'object' && existing.spec !== null) {
      out.spec = { ...(existing.spec as Record<string, unknown>), title };
    }
  }
  if (isDefault !== undefined) out.isDefault = isDefault;
  return out;
}

/**
 * The spec with widget `widgetId` replaced by `widget`, keeping its id, and its place on the grid unless
 * `widget` brings one;
 * `null` when the spec has no such widget (or is not a spec).
 */
export function replaceWidget(spec: unknown, widgetId: string, widget: Widget): Record<string, unknown> | null {
  const parsed = storedSpec.safeParse(spec);
  if (!parsed.success) return null;
  const index = parsed.data.widgets.findIndex((w) => w.id === widgetId);
  if (index === -1) return null;
  const widgets = [...parsed.data.widgets];
  const layout = (widget as { layout?: unknown }).layout ?? widgets[index].layout;
  widgets[index] = { ...widget, id: widgetId, ...(layout !== undefined ? { layout } : {}) };
  return { ...parsed.data, widgets };
}

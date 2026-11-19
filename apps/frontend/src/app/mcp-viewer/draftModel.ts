import { z } from 'zod';
import type { ViewSpec } from '@fluid/shared';

// Pure helpers of drafted views: the preview while the assistant writes, and what `save_view` sends.

/** A widget as far as the streamed arguments tell. */
export interface PreviewWidget {
  key: string;
  type: string;
  title?: string;
}
export interface DraftPreview {
  title?: string;
  widgets: PreviewWidget[];
}

const partialSchema = z.object({
  arguments: z.object({
    view: z.object({
      title: z.string().optional().catch(undefined),
      widgets: z.array(z.unknown()).optional().catch(undefined),
    }),
  }),
});
const partialWidget = z.object({ id: z.string().optional().catch(undefined), type: z.string().min(1), title: z.string().optional().catch(undefined) });

/** At most this many widgets are previewed (the streamed arguments are untrusted). */
const MAX_PREVIEW_WIDGETS = 24;

/**
 * The preview of `ui/notifications/tool-input-partial` (or `tool-input`) of `draft_view`: the title and
 * the widgets complete enough to have a type. Null for any other tool's input.
 */
export function previewFromInput(params: unknown): DraftPreview | null {
  const parsed = partialSchema.safeParse(params);
  if (!parsed.success) return null;
  const { title, widgets = [] } = parsed.data.arguments.view;
  const shown = widgets.slice(0, MAX_PREVIEW_WIDGETS).flatMap((raw, i) => {
    const w = partialWidget.safeParse(raw);
    return w.success ? [{ key: w.data.id ?? `w${i}`, type: w.data.type, ...(w.data.title ? { title: w.data.title } : {}) }] : [];
  });
  return { ...(title ? { title: title.slice(0, 200) } : {}), widgets: shown };
}

/** The draft fields of a finalized spec: what the assistant wrote, without the system fields. */
export function draftOf(spec: ViewSpec): Record<string, unknown> {
  const { version: _v, id: _id, concept: _c, intent: _i, scope: _s, ...draft } = spec;
  return draft;
}

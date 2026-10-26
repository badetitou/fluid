import { z } from 'zod';
import { dataBindingSchema, widgetBase } from './common';

/**
 * One inspector tab served by a Spec-Fluid backend (Pharo / Moose), drawn as
 * Pharo built it: tables, trees, Roassal canvases (SVG), text, and composites
 * of those (see `specFluid.ts` for the document). Cells, rows, tree nodes and
 * SVG elements naming an entity open it in a new column and emit it on `selected`.
 */
export const specPresenterWidgetSchema = z.object({
  type: z.literal('specPresenter'),
  ...widgetBase,
  /** The Spec-Fluid node to draw: usually `{ "query": "<tab key>", "path": "root" }`. */
  data: dataBindingSchema,
  /** Pixel height above which the tab scrolls (default: the tab's own height). */
  maxHeight: z.number().int().positive().optional(),
});
export type SpecPresenterWidget = z.infer<typeof specPresenterWidgetSchema>;

/** How the LLM is told to use the Spec-Fluid presenter widget. */
export const specPresenterWidgetDoc = `- { "id": string, "type": "specPresenter", "title"?: string, "span"?: 1..24, "maxHeight"?: number,
    "data": { "query": ..., "path": "root" } }
    Displays ONE INSPECTOR TAB of a Moose / Pharo entity as Pharo built it (Spec-Fluid document): tables,
    trees, Roassal visualizations (SVG), source text and their compositions. Its data does NOT come from
    GraphQL but from a Spec-Fluid data source, whose query result is \`{ "root": <node> }\`: bind "data" to
    \`{ "query": "<key of that query>", "path": "root" }\`. Rarely write it by hand: fluid adds it when the
    user opens a Pharo inspector tab. Never use it for GraphQL rows (use "table", "tree"… instead).
    Entities it shows are links opening them in a new column; clicking one emits \`{ "id", "type" }\` on
    "selected" (bind a widget to \`{ "query": "@<id>", "path": "selected" }\` to follow the selection).`;

/**
 * A reference configuration (used by the tests), not shipped as a curated
 * view: its data comes from a Spec-Fluid backend, not from a public GraphQL API.
 */
export const specPresenterWidgetExample: SpecPresenterWidget = {
  id: 'tab',
  type: 'specPresenter',
  title: 'Fame',
  maxHeight: 600,
  data: { query: 'miInspectionFame', path: 'root' },
};

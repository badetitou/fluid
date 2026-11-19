import { z } from 'zod';
import { dataBindingSchema, widgetBase } from './common';

/**
 * One view served by a tool in the fluid Open Views format (`openViews/`,
 * `docs/architecture/OPEN-VIEWS.md`): lists, columned lists, trees, SVG, text,
 * diffs, tabs, forwards and composites of those, with the view's actions. Old
 * Spec-Fluid documents (`specFluid.ts`) are still read. Cells, rows, tree items
 * and SVG hotspots naming an entity open it in a new column and emit it on `selected`.
 * The type keeps its first name so that saved views keep working.
 */
export const specPresenterWidgetSchema = z.object({
  type: z.literal('specPresenter'),
  ...widgetBase,
  /** The view to draw: an Open Views response (`{ "query": "<key>" }`), a view node, or a Spec-Fluid node. */
  data: dataBindingSchema,
  /** Pixel height above which the tab scrolls (default: the tab's own height). */
  maxHeight: z.number().int().positive().optional(),
});
export type SpecPresenterWidget = z.infer<typeof specPresenterWidgetSchema>;

/** How the LLM is told to use the Open Views presenter widget. */
export const specPresenterWidgetDoc = `- { "id": string, "type": "specPresenter", "title"?: string, "span"?: 1..24, "maxHeight"?: number,
    "data": { "query": ... } }
    Displays ONE VIEW that a tool (Pharo / Moose, a Python or Node service…) serves about one of its objects,
    in the fluid Open Views format: lists, tables, trees, SVG drawings, source text, diffs, tabs and their
    compositions, with the view's actions as buttons; items not sent at first are loaded on demand. Its data
    does NOT come from GraphQL but from an Open Views data source, whose query result is the view
    (\`{ "key", "title", "view": <node>, "actions"? }\`): bind "data" to \`{ "query": "<key of that query>" }\`
    (an old Spec-Fluid tab query is bound with \`"path": "root"\`). Rarely write it by hand: fluid adds it
    when the user opens a view of an object. Never use it for GraphQL rows (use "table", "tree"… instead).
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

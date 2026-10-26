import { z } from 'zod';
import { dataBindingSchema, linkToSchema, widgetBase } from './common';

/** Elements per side of a matrix beyond which the widget asks to filter instead of drawing. */
export const MATRIX_MAX_SIDE = 300;

/**
 * A dependency matrix: elements in rows, the elements they depend on in
 * columns, each cell colored by the weight of the dependency (a sequential
 * scale from the theme). Two layouts:
 * - `same` (default): a dependency structure matrix (DSM), the same elements on
 *   both axes, the diagonal greyed, cycles (A → B and B → A) in an alert color;
 * - `targets`: a co-usage map, the elements in rows and their distinct targets
 *   in columns (classes × attributes they use, characters × episodes…).
 *
 * Clicking a cell emits `{ source, target, weight }` (the two rows) on
 * `selected`; clicking a label opens the element in a new column and emits its row.
 * Up to `MATRIX_MAX_SIDE` elements per side; beyond, the widget asks to filter.
 */
export const matrixWidgetSchema = z.object({
  type: z.literal('matrix'),
  ...widgetBase,
  /** The elements (or what holds them, see `rowsField`). */
  data: dataBindingSchema,
  /** Dot path from the bound rows to the elements, when they are nested (default: the rows themselves). */
  rowsField: z.string().min(1).optional(),
  /** Dot path of an element's id, unique across the elements (default "id"). */
  idField: z.string().min(1).optional(),
  /** Dot path of an element's label (default: name, title, label… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /** Dot path of an element's group (e.g. "parentPackage.name"): colors and orders both axes. */
  groupField: z.string().min(1).optional(),
  /**
   * Dot path of an element's targets (its dependencies): a list of ids or of objects, possibly
   * through nested lists ("methods.outgoingInvocations.candidates.parentType"). Required.
   */
  targetsField: z.string().min(1),
  /** Dot path of a target's id inside a target object (default "id"); a scalar target is its own id. */
  targetIdField: z.string().min(1).optional(),
  /** Dot path of a target's label, for the columns of a `targets` matrix (default: name, title…). */
  targetLabelField: z.string().min(1).optional(),
  /** Dot path of the weight of a dependency in a target object (default: each occurrence counts 1). */
  weightField: z.string().min(1).optional(),
  /** `same` (default): a square DSM; `targets`: the distinct targets in columns (co-usage map). */
  columns: z.enum(['same', 'targets']).optional(),
  /** Initial order of the axes (default "group" with a `groupField`, else "original"). */
  sort: z.enum(['original', 'name', 'group', 'weight']).optional(),
  /** Opens the clicked element (row label, and column label of a DSM) in a new column. */
  linkTo: linkToSchema.optional(),
  /** Opens the clicked column label of a `targets` matrix in a new column. */
  targetLinkTo: linkToSchema.optional(),
});
export type MatrixWidget = z.infer<typeof matrixWidgetSchema>;
export type MatrixSort = NonNullable<MatrixWidget['sort']>;

/** How the LLM is told to use the matrix widget. */
export const matrixWidgetDoc = `- { "id": string, "type": "matrix", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: ... }, "targetsField": string, "rowsField"?: string, "idField"?: string,
    "labelField"?: string, "groupField"?: string, "targetIdField"?: string, "targetLabelField"?: string,
    "weightField"?: string, "columns"?: "same" | "targets", "sort"?: "original" | "name" | "group" | "weight",
    "linkTo"?: LinkConfig, "targetLinkTo"?: LinkConfig }
    Use it for "WHO DEPENDS ON WHOM" between many items, when a graph would be unreadable: a dependency
    structure matrix (DSM) of packages, classes or modules (calls, imports, references), a co-usage map
    (classes × the attributes they use, characters × the episodes they appear in), a heat map of counts
    between two sets. Prefer "network" under ~50 sparsely linked items, where arrows read well; a matrix
    stays readable up to 300 × 300 and shows cycles at a glance.
    The bound rows are the ELEMENTS. "targetsField" (required) is the dot path of each element's targets:
    a list of ids, or of objects identified by "targetIdField" (default "id"), possibly crossing nested lists
    (\`methods { outgoingInvocations { candidates { parentType { id } } } }\` →
    "methods.outgoingInvocations.candidates.parentType": the classes a class calls). Repeated targets add
    up; "weightField" reads the weight on each target object instead (an association
    \`dependencies { count target { id } }\` → "targetsField": "dependencies", "targetIdField": "target.id",
    "weightField": "count").
    "columns": "same" (default) is a square DSM: the same elements in rows and columns, targets that are
    not among the rows ignored, the diagonal greyed, CYCLES (A → B and B → A) in an alert color. "targets"
    is a co-usage map: rows are the elements, columns their distinct targets (labelled by
    "targetLabelField", default name; select it in the targets).
    "groupField" groups and colors both axes (e.g. "parentPackage.name"); "sort" is the initial order
    (default "group" with a groupField, else "original"; the user can change it). "rowsField": dot path from
    the bound rows to the elements when they are nested (e.g. "classes" under packages).
    Set "linkTo" (the elements' concept) whenever they have an id, and "targetLinkTo" (the targets' concept)
    for the columns of a "targets" matrix: clicking a label opens it in a new column and emits its row on
    "selected". Clicking a cell emits \`{ "source": <row>, "target": <target>, "weight": n }\` on "selected"
    (bind a "descriptions" to \`{ "query": "@<id>", "path": "selected.target" }\` to detail the target).`;

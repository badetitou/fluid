// -----------------------------------------------------------------------------
// Spec-Fluid documents
// -----------------------------------------------------------------------------
// Spec-Fluid is a Pharo project that serves the inspector tabs of Moose
// entities (Spec2 presenters) as JSON. A tab is one tree of nodes: tables,
// trees, Roassal canvases exported as SVG, text, and composites of those.
// Cells and rows naming a Moose entity carry a `ref`: the entity's id in the
// GraphQL source and, when known, its GraphQL type, so fluid can open it.
//
// Deprecated: fluid speaks only fluid Open Views (`./openViews`,
// `docs/architecture/OPEN-VIEWS.md`); Spec-Fluid is one provider of it. This
// file stays only until the old builder goes: badetitou/fluid#51 deletes it.

import { z } from 'zod';

/**
 * An entity of the GraphQL source: its id and, when known, its concrete type.
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidRefSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).optional(),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidRef = z.infer<typeof specFluidRefSchema>;

/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidCellSchema = z.object({
  text: z.string(),
  ref: specFluidRefSchema.optional(),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidCell = z.infer<typeof specFluidCellSchema>;

const columnSchema = z.object({ title: z.string() });

/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export interface SpecFluidTreeNode {
  cells: SpecFluidCell[];
  ref?: SpecFluidRef;
  children?: SpecFluidTreeNode[];
  /** Pharo has more children than it sent (depth or size limit). */
  hasMore?: boolean;
}
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidTreeNodeSchema: z.ZodType<SpecFluidTreeNode> = z.lazy(() =>
  z.object({
    cells: z.array(specFluidCellSchema),
    ref: specFluidRefSchema.optional(),
    children: z.array(specFluidTreeNodeSchema).optional(),
    hasMore: z.boolean().optional(),
  }),
);

/**
 * A highlighted part of a text node: 0-based offsets, `end` exclusive (the selection of a Pharo code presenter).
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidTextRangeSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidTextRange = z.infer<typeof specFluidTextRangeSchema>;

/**
 * Where an entity is drawn in an SVG node (viewBox coordinates).
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidHotspotSchema = z.object({
  ref: specFluidRefSchema,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidNode =
  | {
      kind: 'table';
      columns: { title: string }[];
      rows: { cells: SpecFluidCell[]; ref?: SpecFluidRef }[];
      truncated?: boolean;
    }
  | { kind: 'tree'; columns: { title: string }[]; roots: SpecFluidTreeNode[]; truncated?: boolean }
  | { kind: 'svg'; svg: string; refs?: z.infer<typeof specFluidHotspotSchema>[] }
  | { kind: 'text'; text: string; language?: string; highlights?: SpecFluidTextRange[] }
  /** A short label (a Pharo label, or a string in a layout), drawn inline. */
  | { kind: 'label'; text: string }
  | { kind: 'composite'; direction: 'row' | 'column'; children: SpecFluidNode[] }
  /** A Pharo diff (`SpDiffPresenter`): the older and newer texts. */
  | { kind: 'diff'; before: string; after: string; beforeLabel?: string; afterLabel?: string; language?: string }
  /** A Pharo notebook (`SpNotebookPresenter`): titled pages, `selected` is the 0-based index of the open one. */
  | { kind: 'notebook'; pages: { title: string; node: SpecFluidNode }[]; selected?: number }
  | { kind: 'unsupported'; presenter: string; message?: string };

/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidNodeSchema: z.ZodType<SpecFluidNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('table'),
      columns: z.array(columnSchema),
      rows: z.array(z.object({ cells: z.array(specFluidCellSchema), ref: specFluidRefSchema.optional() })),
      truncated: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal('tree'),
      columns: z.array(columnSchema),
      roots: z.array(specFluidTreeNodeSchema),
      truncated: z.boolean().optional(),
    }),
    z.object({ kind: z.literal('svg'), svg: z.string(), refs: z.array(specFluidHotspotSchema).optional() }),
    z.object({
      kind: z.literal('text'),
      text: z.string(),
      language: z.string().optional(),
      highlights: z.array(specFluidTextRangeSchema).optional(),
    }),
    z.object({ kind: z.literal('label'), text: z.string() }),
    z.object({
      kind: z.literal('composite'),
      direction: z.enum(['row', 'column']),
      children: z.array(specFluidNodeSchema),
    }),
    z.object({
      kind: z.literal('diff'),
      before: z.string(),
      after: z.string(),
      beforeLabel: z.string().optional(),
      afterLabel: z.string().optional(),
      language: z.string().optional(),
    }),
    z.object({
      kind: z.literal('notebook'),
      pages: z.array(z.object({ title: z.string(), node: specFluidNodeSchema })),
      selected: z.number().int().min(0).optional(),
    }),
    z.object({ kind: z.literal('unsupported'), presenter: z.string(), message: z.string().optional() }),
  ]),
);

/**
 * One inspector tab of an entity, in Pharo's order.
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidTabSchema = z.object({
  /** The Pharo method building the tab, e.g. `miInspectionFame:`. */
  key: z.string().min(1),
  title: z.string(),
  order: z.number(),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidTab = z.infer<typeof specFluidTabSchema>;

/**
 * `GET <endpoint>/entities/<id>/tabs`
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidTabsResponseSchema = z.object({
  entity: z.object({ id: z.string(), type: z.string().optional(), name: z.string().optional() }),
  tabs: z.array(specFluidTabSchema),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidTabsResponse = z.infer<typeof specFluidTabsResponseSchema>;

/**
 * `GET <endpoint>/entities/<id>/tabs/<key>`
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidTabResponseSchema = specFluidTabSchema.extend({ root: specFluidNodeSchema });
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidTabResponse = z.infer<typeof specFluidTabResponseSchema>;

/**
 * `POST <endpoint>/entities/<id>/evaluate` with `{ code }`: the code ran with the
 * entity as `self`. `ref` when the result is an entity of the model, `items`
 * (the first ones) when it is a collection. Errors answer `{ error }` (422).
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export const specFluidEvaluationSchema = z.object({
  display: z.string(),
  ref: specFluidRefSchema.optional(),
  items: z.array(specFluidCellSchema).optional(),
  truncated: z.boolean().optional(),
});
/**
 * @deprecated Use fluid Open Views (`./openViews`). Deleted by badetitou/fluid#51.
 */
export type SpecFluidEvaluation = z.infer<typeof specFluidEvaluationSchema>;

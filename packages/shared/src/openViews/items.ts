// -----------------------------------------------------------------------------
// fluid Open Views — the pieces view nodes are made of
// -----------------------------------------------------------------------------
// Refs, cells, columns and items shared by the node kinds (`nodes.ts`) and the
// items route (`protocol.ts`). The protocol is specified in
// `docs/architecture/OPEN-VIEWS.md`.

import { z } from 'zod';

/** An object of the GraphQL source: its id and, when known, its concrete type. */
export const viewRefSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).optional(),
});
export type ViewRef = z.infer<typeof viewRefSchema>;

/** One cell of an item: its text and, when it names an object, a ref to open it. */
export const viewCellSchema = z.object({
  text: z.string(),
  ref: viewRefSchema.optional(),
});
export type ViewCell = z.infer<typeof viewCellSchema>;

export const viewColumnSchema = z.object({ title: z.string() });
export type ViewColumn = z.infer<typeof viewColumnSchema>;

/** One item of a list, a columned list or a tree: one cell per column (one for a list). */
export interface ViewItem {
  cells: ViewCell[];
  /** The object the whole item stands for. */
  ref?: ViewRef;
  /** Tree only: the children sent with the item. */
  children?: ViewItem[];
  /** Tree only: the item has children, fetched from the items route when `children` is absent. */
  hasChildren?: boolean;
  /** Tree only: the provider cut `children` and cannot page them. */
  truncated?: boolean;
}
export const viewItemSchema: z.ZodType<ViewItem> = z.lazy(() =>
  z.object({
    cells: z.array(viewCellSchema),
    ref: viewRefSchema.optional(),
    children: z.array(viewItemSchema).optional(),
    hasChildren: z.boolean().optional(),
    truncated: z.boolean().optional(),
  }),
);

/**
 * Paging of a list, columned list or tree. `total`: how many items there are in
 * all (the missing ones come from the items route). `lazy`: no item is sent,
 * all come from the items route. `truncated`: the provider cut the items and
 * cannot page them.
 */
export const viewPagingShape = {
  total: z.number().int().min(0).optional(),
  lazy: z.boolean().optional(),
  truncated: z.boolean().optional(),
};

/** A highlighted part of a text node: 0-based offsets, `end` exclusive. */
export const viewTextRangeSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});
export type ViewTextRange = z.infer<typeof viewTextRangeSchema>;

/** Where an object is drawn in an SVG node (viewBox coordinates). */
export const viewHotspotSchema = z.object({
  ref: viewRefSchema,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type ViewHotspot = z.infer<typeof viewHotspotSchema>;

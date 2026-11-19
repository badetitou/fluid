// -----------------------------------------------------------------------------
// fluid Open Views — view nodes
// -----------------------------------------------------------------------------
// A view is one tree of nodes. Kind names follow GT's Phlow views. See
// `docs/architecture/OPEN-VIEWS.md` for the protocol.

import { z } from 'zod';
import {
  viewColumnSchema,
  viewHotspotSchema,
  viewItemSchema,
  viewPagingShape,
  viewRefSchema,
  viewTextRangeSchema,
  type ViewColumn,
  type ViewHotspot,
  type ViewItem,
  type ViewRef,
  type ViewTextRange,
} from './items';

/** Paging fields of `list`, `columnedList` and `tree` (see `viewPagingShape`). */
export interface ViewPaging {
  total?: number;
  lazy?: boolean;
  truncated?: boolean;
}

export const VIEW_NODE_KINDS = [
  'list',
  'columnedList',
  'tree',
  'text',
  'svg',
  'label',
  'composite',
  'tabs',
  'diff',
  'forward',
  'unsupported',
] as const;
export type ViewNodeKind = (typeof VIEW_NODE_KINDS)[number];

export type ViewNode =
  /** A list of single-cell items. */
  | ({ kind: 'list'; items: ViewItem[] } & ViewPaging)
  /** A table: one cell per column in each item. */
  | ({ kind: 'columnedList'; columns: ViewColumn[]; items: ViewItem[] } & ViewPaging)
  /** A tree; `columns` when its items have several cells. */
  | ({ kind: 'tree'; columns?: ViewColumn[]; roots: ViewItem[] } & ViewPaging)
  | { kind: 'text'; text: string; language?: string; highlights?: ViewTextRange[] }
  /** An SVG drawing; `hotspots` are the areas that open an object. */
  | { kind: 'svg'; svg: string; hotspots?: ViewHotspot[] }
  /** A short label, drawn inline. */
  | { kind: 'label'; text: string }
  | { kind: 'composite'; direction: 'row' | 'column'; children: ViewNode[] }
  /** Titled tabs; `selected` is the 0-based index of the open one. */
  | { kind: 'tabs'; tabs: { title: string; node: ViewNode }[]; selected?: number }
  | { kind: 'diff'; before: string; after: string; beforeLabel?: string; afterLabel?: string; language?: string }
  /** Show the views of another object (all of them, or the one whose key is `view`). */
  | { kind: 'forward'; ref: ViewRef; view?: string }
  /** A view the provider cannot export: `type` is its provider-side name. */
  | { kind: 'unsupported'; type: string; message?: string };

const KNOWN_KINDS = new Set<string>(VIEW_NODE_KINDS);

/** A `kind` fluid does not know (a newer provider): exported to JSON Schema as `not: { enum: VIEW_NODE_KINDS }`. */
export const unknownViewKindSchema = z.string().refine((kind) => !KNOWN_KINDS.has(kind), 'a known kind');

/**
 * A node of a kind fluid does not know. Within v1 it is shown as `unsupported`
 * (see the spec, "Versioning"); its other fields are ignored.
 */
const unknownKindNodeSchema = z
  .looseObject({ kind: unknownViewKindSchema })
  .transform((node): ViewNode => ({ kind: 'unsupported', type: node.kind }));

const knownNodeSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('list'), items: z.array(viewItemSchema), ...viewPagingShape }),
    z.object({
      kind: z.literal('columnedList'),
      columns: z.array(viewColumnSchema),
      items: z.array(viewItemSchema),
      ...viewPagingShape,
    }),
    z.object({
      kind: z.literal('tree'),
      columns: z.array(viewColumnSchema).optional(),
      roots: z.array(viewItemSchema),
      ...viewPagingShape,
    }),
    z.object({
      kind: z.literal('text'),
      text: z.string(),
      language: z.string().optional(),
      highlights: z.array(viewTextRangeSchema).optional(),
    }),
    z.object({ kind: z.literal('svg'), svg: z.string(), hotspots: z.array(viewHotspotSchema).optional() }),
    z.object({ kind: z.literal('label'), text: z.string() }),
    z.object({
      kind: z.literal('composite'),
      direction: z.enum(['row', 'column']),
      children: z.array(viewNodeSchema),
    }),
    z.object({
      kind: z.literal('tabs'),
      tabs: z.array(z.object({ title: z.string(), node: viewNodeSchema })),
      selected: z.number().int().min(0).optional(),
    }),
    z.object({
      kind: z.literal('diff'),
      before: z.string(),
      after: z.string(),
      beforeLabel: z.string().optional(),
      afterLabel: z.string().optional(),
      language: z.string().optional(),
    }),
    z.object({ kind: z.literal('forward'), ref: viewRefSchema, view: z.string().min(1).optional() }),
    z.object({ kind: z.literal('unsupported'), type: z.string(), message: z.string().optional() }),
  ]),
);

/** A view node; a node of an unknown kind parses to `{ kind: 'unsupported', type: <its kind> }`. */
export const viewNodeSchema: z.ZodType<ViewNode, unknown> = z.union([knownNodeSchema, unknownKindNodeSchema]);

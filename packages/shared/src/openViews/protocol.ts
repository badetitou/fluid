// -----------------------------------------------------------------------------
// fluid Open Views — protocol documents
// -----------------------------------------------------------------------------
// The JSON bodies of the routes a provider serves under its base URL. The
// routes, status codes and paging rules are in `docs/architecture/OPEN-VIEWS.md`.

import { z } from 'zod';
import { viewCellSchema, viewItemSchema, viewRefSchema } from './items';
import { viewNodeSchema } from './nodes';

export const OPEN_VIEWS_PROTOCOL = 'fluid-views';
export const OPEN_VIEWS_VERSION = 1;
/** Discovery path, relative to the provider's base URL. */
export const OPEN_VIEWS_DISCOVERY_PATH = '/.well-known/fluid-views';

/** What a provider supports beyond reading views. */
export const openViewsCapabilitiesSchema = z.object({
  /** The provider runs view actions (`POST …/actions/<actionId>`). */
  actions: z.boolean().optional(),
  /** The provider evaluates code on an object (`POST …/evaluate`). */
  evaluate: z.boolean().optional(),
});
export type OpenViewsCapabilities = z.infer<typeof openViewsCapabilitiesSchema>;

/** `GET <base>/.well-known/fluid-views` */
export const openViewsDiscoverySchema = z.object({
  protocol: z.literal(OPEN_VIEWS_PROTOCOL),
  version: z.literal(OPEN_VIEWS_VERSION),
  /** The provider's name, shown to the user (e.g. `Moose`). */
  name: z.string().min(1),
  capabilities: openViewsCapabilitiesSchema.default({}),
});
export type OpenViewsDiscovery = z.infer<typeof openViewsDiscoverySchema>;

/** A view of an object, without its content. Views are shown by `priority`, smallest first. */
export const viewDeclarationSchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  priority: z.number(),
});
export type ViewDeclaration = z.infer<typeof viewDeclarationSchema>;

/** `GET <base>/objects/<id>/views` */
export const objectViewsResponseSchema = z.object({
  object: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    label: z.string().optional(),
  }),
  views: z.array(viewDeclarationSchema),
});
export type ObjectViewsResponse = z.infer<typeof objectViewsResponseSchema>;

/** An action the user can run on a view; `confirm` asks first (with this text when a string). */
export const viewActionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  icon: z.string().optional(),
  confirm: z.union([z.boolean(), z.string()]).optional(),
});
export type ViewAction = z.infer<typeof viewActionSchema>;

/** `GET <base>/objects/<id>/views/<key>` */
export const viewResponseSchema = viewDeclarationSchema.extend({
  view: viewNodeSchema,
  actions: z.array(viewActionSchema).optional(),
});
export type ViewResponse = z.infer<typeof viewResponseSchema>;

/**
 * Query of `GET <base>/objects/<id>/views/<key>/items`. `path` names the list
 * or tree node whose items are wanted: dot-separated 0-based indices, first
 * the node in the view (in document order of the pageable nodes), then the
 * item path in a tree (e.g. `0.3.1`: node 0, its root 3, that root's child 1).
 */
export const viewItemsQuerySchema = z.object({
  path: z.string().regex(/^\d+(\.\d+)*$/),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).optional(),
});
export type ViewItemsQuery = z.infer<typeof viewItemsQuerySchema>;

/** Response of the items route: the asked slice and, when known, the full count. */
export const viewItemsResponseSchema = z.object({
  items: z.array(viewItemSchema),
  total: z.number().int().min(0).optional(),
});
export type ViewItemsResponse = z.infer<typeof viewItemsResponseSchema>;

/** `POST <base>/objects/<id>/views/<key>/actions/<actionId>` */
export const viewActionResultSchema = z.object({
  /** Reload the view. */
  refresh: z.boolean().optional(),
  /** Open this object. */
  ref: viewRefSchema.optional(),
  /** Tell the user. */
  message: z.string().optional(),
});
export type ViewActionResult = z.infer<typeof viewActionResultSchema>;

/**
 * `POST <base>/objects/<id>/evaluate` with `{ code }` (capability `evaluate`):
 * the code ran with the object as receiver. `ref` when the result is an object
 * of the source, `items` (the first ones) when it is a collection.
 */
export const viewEvaluationRequestSchema = z.object({ code: z.string() });
export const viewEvaluationSchema = z.object({
  display: z.string(),
  ref: viewRefSchema.optional(),
  items: z.array(viewCellSchema).optional(),
  truncated: z.boolean().optional(),
});
export type ViewEvaluation = z.infer<typeof viewEvaluationSchema>;

/** Body of every 4xx/5xx answer. `code` is a machine-readable reason (see the spec's error table). */
export const openViewsErrorSchema = z.object({
  error: z.string(),
  code: z.string().min(1),
});
export type OpenViewsError = z.infer<typeof openViewsErrorSchema>;

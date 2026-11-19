import { z } from 'zod';
import { VIEW_NODE_KINDS, type ViewDeclaration, type ViewSpec } from '@fluid/shared';
import type { Concept } from '../../../../graphql/introspection';
import type { Perspective } from '../../viewBuilder';

// The pure half of the fluid Open Views builder: the endpoints it reads, the
// URLs of the protocol, the perspectives it makes and the queries its data
// source answers. The protocol is in `docs/architecture/OPEN-VIEWS.md`.

/** The setting of the generic builder: base URLs, one per line (or separated by spaces or commas). */
export const ENDPOINTS_SETTING = 'endpoints';

/** One view of one object (answers a `ViewResponse`). */
export const VIEW_QUERY = 'view';

/** A page of the items of a list, columned list or tree of a view (answers a `ViewItemsResponse`). */
export const ITEMS_QUERY = 'items';

/** A base URL without its trailing slashes. */
export const trimEndpoint = (endpoint: string): string => endpoint.trim().replace(/\/+$/, '');

/** The http(s) base URLs of a setting, trimmed and without duplicates, in the order given. */
export function parseEndpoints(value: string | undefined): string[] {
  const endpoints = (value ?? '')
    .split(/[\s,]+/)
    .map(trimEndpoint)
    .filter((endpoint) => /^https?:\/\/\S+$/i.test(endpoint));
  return [...new Set(endpoints)];
}

/** `<endpoint>/<segment>/…`, each segment URL-encoded (ids hold `:`, Pharo keys end with `:`). */
export function openViewsUrl(endpoint: string, ...segments: string[]): string {
  return [trimEndpoint(endpoint), ...segments.map(encodeURIComponent)].join('/');
}

/** The query string of the items route. */
export function itemsSearch({ path, offset, limit }: { path: string; offset?: number; limit?: number }): string {
  const params = new URLSearchParams({ path });
  if (offset !== undefined) params.set('offset', String(offset));
  if (limit !== undefined) params.set('limit', String(limit));
  return `?${params.toString()}`;
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(VIEW_NODE_KINDS);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A view node as sent, with every node of a kind fluid does not know replaced
 * by `{ kind: 'unsupported', type }` (the spec asks fluid to show it so; the
 * schema would reject it). Walks composite children and tab pages.
 */
export function normalizeUnknownKinds(node: unknown): unknown {
  if (!isRecord(node) || typeof node.kind !== 'string') return node;
  if (!KNOWN_KINDS.has(node.kind)) {
    return { kind: 'unsupported', type: node.kind, message: `fluid does not know views of kind "${node.kind}".` };
  }
  if (node.kind === 'composite' && Array.isArray(node.children)) {
    return { ...node, children: node.children.map(normalizeUnknownKinds) };
  }
  if (node.kind === 'tabs' && Array.isArray(node.tabs)) {
    return { ...node, tabs: node.tabs.map((tab) => (isRecord(tab) ? { ...tab, node: normalizeUnknownKinds(tab.node) } : tab)) };
  }
  return node;
}

/** A `ViewResponse` as sent, its `view` node normalized (see `normalizeUnknownKinds`). */
export const normalizeViewResponse = (body: unknown): unknown =>
  isRecord(body) && 'view' in body ? { ...body, view: normalizeUnknownKinds(body.view) } : body;

const viewVariablesSchema = z.object({
  endpoint: z.string().min(1),
  id: z.string().min(1),
  view: z.string().min(1),
});
const itemsVariablesSchema = viewVariablesSchema.extend({
  path: z.string().regex(/^\d+(\.\d+)*$/),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).optional(),
});
export type ViewVariables = z.infer<typeof viewVariablesSchema>;
export type ItemsVariables = z.infer<typeof itemsVariablesSchema>;

/**
 * The variables of a `view` or `items` query, checked (they come from a saved
 * view or the LLM): the endpoint must be one the user configured, so a view
 * cannot make fluid call any other URL.
 */
export function queryVariables(query: string, variables: Record<string, unknown>, endpoints: string[]): ViewVariables | ItemsVariables {
  const schema = query === ITEMS_QUERY ? itemsVariablesSchema : viewVariablesSchema;
  const parsed = schema.safeParse(variables);
  if (!parsed.success) {
    throw new Error(`An Open Views "${query}" query needs ${query === ITEMS_QUERY ? '"endpoint", "id", "view" and "path"' : '"endpoint", "id" and "view"'}.`);
  }
  const endpoint = trimEndpoint(parsed.data.endpoint);
  if (!endpoints.includes(endpoint)) throw new Error(`${endpoint} is not one of the Open Views endpoints set in Settings → Plugins.`);
  return { ...parsed.data, endpoint };
}

/** The views every endpoint declared for an object. */
export interface EndpointViews {
  endpoint: string;
  views: ViewDeclaration[];
}

/** Every declared view, by `priority` (smallest first); ties keep the endpoint order, then the order sent. */
export function mergeByPriority(lists: EndpointViews[]): { endpoint: string; view: ViewDeclaration }[] {
  return lists
    .flatMap(({ endpoint, views }) => views.map((view) => ({ endpoint, view })))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.view.priority - b.entry.view.priority || a.index - b.index)
    .map(({ entry }) => entry);
}

/** The perspective showing one view of an item, read from the data source `source`. */
export function viewPerspective(source: string, concept: Concept, itemId: string, endpoint: string, view: ViewDeclaration): Perspective {
  const spec: ViewSpec = {
    version: 1,
    id: `${source}-${concept.name}-${view.key}`.replace(/[^A-Za-z0-9-]/g, '-'),
    concept: concept.name,
    scope: 'detail',
    title: view.title,
    queries: { [VIEW_QUERY]: { source, query: VIEW_QUERY, variables: { endpoint, id: itemId, view: view.key } } },
    widgets: [{ id: 'view', type: 'specPresenter', span: 24, data: { query: VIEW_QUERY, path: 'view' } }],
  };
  return { key: `${source}:${endpoint}:${view.key}`, title: view.title, origin: 'remote', spec };
}

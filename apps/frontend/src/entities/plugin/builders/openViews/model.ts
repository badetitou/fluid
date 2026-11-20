import { z } from 'zod';
import { OPEN_VIEWS_QUERIES, VIEW_NODE_KINDS, type ViewDeclaration, type ViewSpec } from '@fluid/shared';
import type { Concept } from '../../../../graphql/introspection';
import type { Perspective } from '../../viewBuilder';

// The pure half of the fluid Open Views builder: the endpoints it reads, the
// URLs of the protocol, the perspectives it makes and the queries its data
// source answers. The protocol is in `docs/architecture/OPEN-VIEWS.md`.

/** The setting of the generic builder: base URLs, one per line (or separated by spaces or commas). */
export const ENDPOINTS_SETTING = 'endpoints';

/** The queries the data source answers (contract shared with the `specPresenter` widget). */
export type OpenViewsQuery = keyof typeof OPEN_VIEWS_QUERIES;
const QUERY_NAMES: ReadonlySet<string> = new Set(Object.values(OPEN_VIEWS_QUERIES));
export const isOpenViewsQuery = (query: string): query is OpenViewsQuery => QUERY_NAMES.has(query);

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

const objectVariables = z.object({ endpoint: z.string().min(1).optional(), id: z.string().min(1) });
const viewVariables = objectVariables.extend({ view: z.string().min(1) });
const VARIABLES = {
  views: objectVariables,
  view: viewVariables,
  items: viewVariables.extend({
    path: z.string().regex(/^\d+(\.\d+)*$/),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).optional(),
  }),
  action: viewVariables.extend({ action: z.string().min(1) }),
};
export type QueryVariables<Q extends OpenViewsQuery> = z.infer<(typeof VARIABLES)[Q]>;

const NEEDS: Record<OpenViewsQuery, string> = {
  views: '"id"',
  view: '"id" and "view"',
  items: '"id", "view" and "path"',
  action: '"id", "view" and "action"',
};

/** The variables of a query, checked (they come from a saved view, the LLM or a widget). */
export function queryVariables<Q extends OpenViewsQuery>(query: Q, variables: Record<string, unknown>): QueryVariables<Q> {
  const parsed = VARIABLES[query].safeParse(variables);
  if (!parsed.success) throw new Error(`An Open Views "${query}" query needs ${NEEDS[query]}.`);
  return parsed.data as QueryVariables<Q>;
}

/**
 * The endpoint a query names, when it is one the user configured. Otherwise
 * (none named, or one no longer configured),
 * fluid looks for the object on the configured ones: it never calls any other URL.
 */
export function configuredEndpoint(endpoint: string | undefined, endpoints: string[]): string | undefined {
  const base = endpoint === undefined ? undefined : trimEndpoint(endpoint);
  return base !== undefined && endpoints.includes(base) ? base : undefined;
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
    id: `${source}-${endpoint}-${concept.name}-${view.key}`.replace(/[^A-Za-z0-9-]/g, '-'),
    concept: concept.name,
    scope: 'detail',
    title: view.title,
    queries: { view: { source, query: OPEN_VIEWS_QUERIES.view, variables: { endpoint, id: itemId, view: view.key } } },
    widgets: [{ id: 'view', type: 'specPresenter', span: 24, data: { query: 'view' } }],
  };
  return { key: `${source}:${endpoint}:${view.key}`, title: view.title, origin: 'remote', spec };
}

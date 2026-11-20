import type { z } from 'zod';
import {
  describeIssues,
  objectViewsResponseSchema,
  openViewsDiscoverySchema,
  OPEN_VIEWS_DISCOVERY_PATH,
  viewActionResultSchema,
  viewItemsResponseSchema,
  viewResponseSchema,
  type ObjectViewsResponse,
  type OpenViewsCapabilities,
  type ViewActionResult,
  type ViewItemsResponse,
  type ViewResponse,
} from '@fluid/shared';
import { itemsSearch, normalizeViewResponse, openViewsUrl, trimEndpoint } from './model';

/** An Open Views provider, as its discovery document describes it. */
export interface ViewProvider {
  endpoint: string;
  name: string;
  capabilities: OpenViewsCapabilities;
}

/** An HTTP answer other than 2xx, with the provider's error message. */
export class OpenViewsHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** How long a provider has to answer a request. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** A signal aborted by the caller's, or after `ms`; `done` clears the timer. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Open Views: no answer within ${ms / 1000} s.`)), ms);
  const forward = () => controller.abort(signal?.reason);
  if (signal?.aborted) forward();
  else signal?.addEventListener('abort', forward, { once: true });
  const done = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  };
  return { signal: controller.signal, done };
}

/**
 * Calls a provider route (GET unless `init` says otherwise), giving up after
 * `REQUEST_TIMEOUT_MS`, and validates its JSON once `prepare` has adjusted it;
 * an error body becomes the message.
 */
async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  init?: RequestInit,
  prepare: (body: unknown) => unknown = (body) => body,
): Promise<T> {
  const timed = withTimeout(signal, REQUEST_TIMEOUT_MS);
  let res: Response;
  let body: unknown;
  try {
    res = await fetch(url, { ...init, signal: timed.signal, credentials: 'omit' });
    body = await res.json().catch(() => null);
  } finally {
    timed.done();
  }
  if (!res.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : `HTTP ${res.status}`;
    throw new OpenViewsHttpError(res.status, `Open Views: ${message}`);
  }
  const parsed = schema.safeParse(prepare(body));
  if (!parsed.success) throw new Error(`${url} sent an unexpected answer:\n${describeIssues(parsed.error)}`);
  return parsed.data;
}

async function discover(endpoint: string): Promise<ViewProvider> {
  const { name, capabilities } = await getJson(endpoint + OPEN_VIEWS_DISCOVERY_PATH, openViewsDiscoverySchema);
  return { endpoint, name, capabilities };
}

const providers = new Map<string, Promise<ViewProvider>>();

/**
 * The provider at `endpoint`, from its discovery document (asked once per
 * session). A failed or timed-out discovery is asked again next time.
 */
export function discoverProvider(endpoint: string): Promise<ViewProvider> {
  const base = trimEndpoint(endpoint);
  let provider = providers.get(base);
  if (!provider) {
    provider = discover(base);
    providers.set(base, provider);
    provider.catch(() => providers.delete(base));
  }
  return provider;
}

/** Forgets every discovered provider (tests, or after the user changed endpoints). */
export const forgetProviders = (): void => providers.clear();

/** The views an object declares. */
export const fetchObjectViews = (provider: ViewProvider, id: string, signal?: AbortSignal): Promise<ObjectViewsResponse> =>
  getJson(openViewsUrl(provider.endpoint, 'objects', id, 'views'), objectViewsResponseSchema, signal);

/** One view of an object, its unknown node kinds shown as `unsupported`. */
export const fetchView = (provider: ViewProvider, id: string, key: string, signal?: AbortSignal): Promise<ViewResponse> =>
  getJson(openViewsUrl(provider.endpoint, 'objects', id, 'views', key), viewResponseSchema, signal, undefined, normalizeViewResponse);

/** A page of the items of a list, columned list or tree of a view (`path`: see the spec). */
export function fetchItems(
  provider: ViewProvider,
  id: string,
  key: string,
  query: { path: string; offset?: number; limit?: number },
  signal?: AbortSignal,
): Promise<ViewItemsResponse> {
  const url = openViewsUrl(provider.endpoint, 'objects', id, 'views', key, 'items') + itemsSearch(query);
  return getJson(url, viewItemsResponseSchema, signal);
}

/**
 * Runs an action of a view (capability `actions`): a POST with no body, as
 * the spec allows, so the browser sends it without a CORS preflight.
 */
export async function runAction(provider: ViewProvider, id: string, key: string, action: string, signal?: AbortSignal): Promise<ViewActionResult> {
  if (!provider.capabilities.actions) throw new Error(`${provider.name} does not run view actions (no "actions" capability).`);
  const url = openViewsUrl(provider.endpoint, 'objects', id, 'views', key, 'actions', action);
  return getJson(url, viewActionResultSchema, signal, { method: 'POST' });
}

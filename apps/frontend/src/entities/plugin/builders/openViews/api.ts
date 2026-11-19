import type { z } from 'zod';
import {
  describeIssues,
  objectViewsResponseSchema,
  openViewsDiscoverySchema,
  OPEN_VIEWS_DISCOVERY_PATH,
  specFluidEvaluationSchema,
  specFluidTabResponseSchema,
  specFluidTabsResponseSchema,
  specFluidTabToView,
  specFluidTabsToViews,
  viewActionResultSchema,
  viewEvaluationSchema,
  viewItemsResponseSchema,
  viewResponseSchema,
  type ObjectViewsResponse,
  type OpenViewsCapabilities,
  type ViewActionResult,
  type ViewEvaluation,
  type ViewItemsResponse,
  type ViewResponse,
} from '@fluid/shared';
import { itemsSearch, normalizeViewResponse, openViewsUrl, trimEndpoint } from './model';

/** A provider of views: an Open Views endpoint, or an old Spec-Fluid one read through `legacy.ts`. */
export type ViewProvider =
  | { endpoint: string; protocol: 'open-views'; name: string; capabilities: OpenViewsCapabilities }
  | { endpoint: string; protocol: 'spec-fluid' };

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

async function discover(endpoint: string, legacy: boolean): Promise<ViewProvider> {
  try {
    const { name, capabilities } = await getJson(endpoint + OPEN_VIEWS_DISCOVERY_PATH, openViewsDiscoverySchema);
    return { endpoint, protocol: 'open-views', name, capabilities };
  } catch (error) {
    if (legacy && error instanceof OpenViewsHttpError && error.status === 404) return { endpoint, protocol: 'spec-fluid' };
    throw error;
  }
}

const providers = new Map<string, Promise<ViewProvider>>();

/**
 * The provider at `endpoint`, from its discovery document (asked once per
 * session). With `legacy`, an endpoint answering 404 there is an old
 * Spec-Fluid server. A failed or timed-out discovery is asked again next time.
 */
export function discoverProvider(endpoint: string, legacy: boolean): Promise<ViewProvider> {
  const base = trimEndpoint(endpoint);
  const key = `${legacy ? 'legacy' : 'open'}|${base}`;
  let provider = providers.get(key);
  if (!provider) {
    provider = discover(base, legacy);
    providers.set(key, provider);
    provider.catch(() => providers.delete(key));
  }
  return provider;
}

/** Forgets every discovered provider (tests, or after the user changed endpoints). */
export const forgetProviders = (): void => providers.clear();

/** The views an object declares. */
export async function fetchObjectViews(provider: ViewProvider, id: string, signal?: AbortSignal): Promise<ObjectViewsResponse> {
  if (provider.protocol === 'spec-fluid') {
    const tabs = await getJson(openViewsUrl(provider.endpoint, 'entities', id, 'tabs'), specFluidTabsResponseSchema, signal);
    return specFluidTabsToViews(tabs);
  }
  return getJson(openViewsUrl(provider.endpoint, 'objects', id, 'views'), objectViewsResponseSchema, signal);
}

/** One view of an object, its unknown node kinds shown as `unsupported`. */
export async function fetchView(provider: ViewProvider, id: string, key: string, signal?: AbortSignal): Promise<ViewResponse> {
  if (provider.protocol === 'spec-fluid') {
    const tab = await getJson(openViewsUrl(provider.endpoint, 'entities', id, 'tabs', key), specFluidTabResponseSchema, signal);
    return specFluidTabToView(tab);
  }
  const url = openViewsUrl(provider.endpoint, 'objects', id, 'views', key);
  return getJson(url, viewResponseSchema, signal, undefined, normalizeViewResponse);
}

/** A page of the items of a list, columned list or tree of a view (`path`: see the spec). */
export function fetchItems(
  provider: ViewProvider,
  id: string,
  key: string,
  query: { path: string; offset?: number; limit?: number },
  signal?: AbortSignal,
): Promise<ViewItemsResponse> {
  if (provider.protocol === 'spec-fluid') {
    return Promise.reject(new Error('Spec-Fluid servers send every item with the view: they cannot page them.'));
  }
  const url = openViewsUrl(provider.endpoint, 'objects', id, 'views', key, 'items') + itemsSearch(query);
  return getJson(url, viewItemsResponseSchema, signal);
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Runs an action of a view (capability `actions`). */
export async function runAction(provider: ViewProvider, id: string, key: string, action: string, signal?: AbortSignal): Promise<ViewActionResult> {
  if (provider.protocol === 'spec-fluid' || !provider.capabilities.actions) {
    throw new Error(`${provider.protocol === 'spec-fluid' ? 'Spec-Fluid' : provider.name} does not run view actions (no "actions" capability).`);
  }
  const url = openViewsUrl(provider.endpoint, 'objects', id, 'views', key, 'actions', action);
  return getJson(url, viewActionResultSchema, signal, postJson({}));
}

/**
 * Evaluates code with an object as receiver, through the `evaluate` capability
 * of an Open Views endpoint, or the evaluate route of an old Spec-Fluid one.
 */
export async function evaluateOn(endpoint: string, id: string, code: string, signal?: AbortSignal): Promise<ViewEvaluation> {
  const provider = await discoverProvider(endpoint, true);
  if (provider.protocol === 'spec-fluid') {
    return getJson(openViewsUrl(provider.endpoint, 'entities', id, 'evaluate'), specFluidEvaluationSchema, signal, postJson({ code }));
  }
  if (!provider.capabilities.evaluate) throw new Error(`${provider.name} does not evaluate code (no "evaluate" capability).`);
  return getJson(openViewsUrl(provider.endpoint, 'objects', id, 'evaluate'), viewEvaluationSchema, signal, postJson({ code }));
}

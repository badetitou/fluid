import type { ViewScope, ViewSpec, Widget } from '@fluid/shared';
import { BFF_URL } from '../runtime-config';

// Thin fetch wrapper around the Fluid BFF REST API (view persistence + prefs).
// Every call is resilient at the call site: the UI treats a rejected promise as
// "BFF unavailable" and falls back to curated/auto views + localStorage prefs.

const BASE = BFF_URL;

export interface SavedView {
  id: string;
  concept: string;
  title: string;
  spec: ViewSpec;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateViewPatch {
  spec?: ViewSpec;
  title?: string;
  isDefault?: boolean;
}

export type LlmProvider = 'openai' | 'ollama' | 'claude-code' | 'mock';

export interface LlmConfigOverrides {
  provider?: LlmProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface LlmCapabilities {
  defaultProvider: LlmProvider;
  providers: {
    openai: { configured: boolean; model: string; baseUrl: string };
    ollama: { model: string; baseUrl: string };
    'claude-code'?: { available: boolean; version: string | null; model: string };
    mock: { available: boolean };
  };
}

export interface ConceptSchemaPayload {
  name: string;
  description?: string | null;
  listQuery?: string | null;
  /** Rows field when the list query returns a pagination wrapper (e.g. "results"). */
  listItemsPath?: string | null;
  /** Row-limit argument of the list query (e.g. "take"), when it has one. */
  listLimitArg?: string | null;
  byIdQuery?: string | null;
  /** Key argument of the by-id query when it is not `id` (e.g. "code"). */
  byIdArgName?: string | null;
  /** GraphQL type of the by-id query's key argument (defaults to "ID!"). */
  byIdArgType?: string | null;
  fields: {
    name: string;
    typeName: string;
    typeKind: string;
    isList?: boolean;
    isScalar?: boolean;
    description?: string | null;
  }[];
  related?: { name: string; fields?: string[] }[];
  /** Relations reachable through nested selections, several levels deep. */
  paths?: RelationPathPayload[];
}

/** One relation reachable from the concept, e.g. "accounts.transactions". */
export interface RelationPathPayload {
  /** Dot path of relation fields from the concept, e.g. "accounts.transactions". */
  path: string;
  typeName: string;
  /** Whether any segment of the path is a list (the path then yields many rows). */
  isList: boolean;
  /** Scalar fields of the target, as "name: Type". */
  fields: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateViewPayload {
  concept: string;
  schema: ConceptSchemaPayload;
  prompt: string;
  /** List or detail column the view is generated for. */
  scope?: ViewScope;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateViewResponse {
  spec: ViewSpec;
  provider: LlmProvider;
  model: string;
  reasoning?: string[];
}

export interface GenerateWidgetPayload {
  concept: string;
  schema: ConceptSchemaPayload;
  prompt: string;
  existingWidget?: Widget;
  viewQueries?: Record<string, string>;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateWidgetResponse {
  /** Unvalidated: parse it with `widgetSchema` before use. */
  widget: unknown;
  provider: LlmProvider;
  model: string;
  reasoning?: string[];
}

/** A chunk of model output streamed while a view is being generated. */
export interface LlmDelta {
  kind: 'text' | 'thinking';
  text: string;
}

/**
 * Generate a view over the BFF's Server-Sent Events endpoint, forwarding live
 * deltas to `onDelta`. Resolves with the final result, rejects on error events.
 */
async function generateViewStream(
  payload: GenerateViewPayload,
  onDelta: (delta: LlmDelta) => void,
  signal?: AbortSignal,
): Promise<GenerateViewResponse> {
  const path = '/api/llm/generate-view/stream';
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`BFF POST ${path} → ${res.status} ${detail}`.trim());
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (!event || data === undefined) continue;
      const parsed = JSON.parse(data);
      if (event === 'delta') onDelta(parsed as LlmDelta);
      else if (event === 'result') return parsed as GenerateViewResponse;
      else if (event === 'error') {
        const { error, details } = parsed as { error: string; details?: string };
        throw new Error(details ? `${error}\n${details}` : error);
      }
    }
  }
  throw new Error('The generation stream ended without a result');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json' } : undefined;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    ...(headers ? { headers } : {}),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* body was not JSON */
    }
    throw new Error(`BFF ${init?.method ?? 'GET'} ${path} → ${res.status} ${detail}`.trim());
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const bffClient = {
  base: BASE,
  health: () => request<{ status: string; service: string }>('/health'),
  listViews: (concept?: string) =>
    request<SavedView[]>(
      `/api/views${concept ? `?concept=${encodeURIComponent(concept)}` : ''}`,
    ),
  getView: (id: string) => request<SavedView>(`/api/views/${encodeURIComponent(id)}`),
  createView: (spec: ViewSpec, isDefault?: boolean) =>
    request<SavedView>('/api/views', {
      method: 'POST',
      body: JSON.stringify({ spec, isDefault }),
    }),
  updateView: (id: string, patch: UpdateViewPatch) =>
    request<SavedView>(`/api/views/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteView: (id: string) =>
    request<void>(`/api/views/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getPrefs: () => request<Record<string, unknown>>('/api/prefs'),
  putPrefs: (prefs: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/prefs', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),
  getLlmConfig: () => request<LlmCapabilities>('/api/llm/config'),
  generateView: (payload: GenerateViewPayload) =>
    request<GenerateViewResponse>('/api/llm/generate-view', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  generateViewStream,
  generateWidget: (payload: GenerateWidgetPayload) =>
    request<GenerateWidgetResponse>('/api/llm/generate-widget', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateViewWidget: (viewId: string, widgetId: string, widget: Widget) =>
    request<SavedView>(`/api/views/${encodeURIComponent(viewId)}/widgets/${encodeURIComponent(widgetId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ widget }),
    }),
};

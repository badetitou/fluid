import type { ViewSpec } from '@fluid/shared';
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

export type LlmProvider = 'openai' | 'ollama' | 'mock';

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
    mock: { available: boolean };
  };
}

export interface ConceptSchemaPayload {
  name: string;
  description?: string | null;
  listQuery?: string | null;
  byIdQuery?: string | null;
  fields: {
    name: string;
    typeName: string;
    typeKind: string;
    isList?: boolean;
    isScalar?: boolean;
    description?: string | null;
  }[];
  related?: { name: string; fields?: string[] }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateViewPayload {
  concept: string;
  schema: ConceptSchemaPayload;
  prompt: string;
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
  existingWidget?: any;
  viewQueries?: Record<string, string>;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateWidgetResponse {
  widget: any;
  provider: LlmProvider;
  model: string;
  reasoning?: string[];
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
  generateWidget: (payload: GenerateWidgetPayload) =>
    request<GenerateWidgetResponse>('/api/llm/generate-widget', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateViewWidget: (viewId: string, widgetId: string, widget: any) =>
    request<SavedView>(`/api/views/${encodeURIComponent(viewId)}/widgets/${encodeURIComponent(widgetId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ widget }),
    }),
};

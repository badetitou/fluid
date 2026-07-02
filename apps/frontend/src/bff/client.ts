import type { ViewSpec } from '@fluid/shared';

// Thin fetch wrapper around the Fluid BFF REST API (view persistence + prefs).
// Every call is resilient at the call site: the UI treats a rejected promise as
// "BFF unavailable" and falls back to curated/auto views + localStorage prefs.

const BASE = (import.meta.env.VITE_BFF_URL ?? 'http://localhost:4001').replace(/\/$/, '');

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
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
};

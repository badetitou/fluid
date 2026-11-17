import { BFF_URL } from '../runtime-config';

export const BASE = BFF_URL;

/** A JSON call to the BFF; a non-2xx answer throws with the status and its body. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

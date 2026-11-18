import { BFF_URL } from '../runtime-config';

export const BASE = BFF_URL;

/** A non-2xx answer of the BFF: the message says status and body, `status` is machine-readable. */
export class BffHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BffHttpError';
  }
}

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
    throw new BffHttpError(`BFF ${init?.method ?? 'GET'} ${path} → ${res.status} ${detail}`.trim(), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

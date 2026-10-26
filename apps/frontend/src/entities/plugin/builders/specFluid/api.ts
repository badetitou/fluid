import type { z } from 'zod';
import {
  specFluidTabResponseSchema,
  specFluidTabsResponseSchema,
  describeIssues,
  type SpecFluidTabResponse,
  type SpecFluidTabsResponse,
} from '@fluid/shared';
import { specFluidUrl } from './model';

/** GETs a Spec-Fluid route and validates its JSON; a Spec-Fluid error body becomes the message. */
async function getJson<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: 'omit' });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String(body.error) : `HTTP ${res.status}`;
    throw new Error(`Spec-Fluid: ${message}`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(`Spec-Fluid sent an unexpected answer:\n${describeIssues(parsed.error)}`);
  return parsed.data;
}

/** The inspector tabs of an entity. */
export const fetchTabs = (endpoint: string, id: string, signal?: AbortSignal): Promise<SpecFluidTabsResponse> =>
  getJson(specFluidUrl(endpoint, 'entities', id, 'tabs'), specFluidTabsResponseSchema, signal);

/** One inspector tab of an entity, as a Spec-Fluid document. */
export const fetchTab = (endpoint: string, id: string, tab: string, signal?: AbortSignal): Promise<SpecFluidTabResponse> =>
  getJson(specFluidUrl(endpoint, 'entities', id, 'tabs', tab), specFluidTabResponseSchema, signal);

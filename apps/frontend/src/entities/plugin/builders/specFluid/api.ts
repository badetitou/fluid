import type { z } from 'zod';
import {
  specFluidTabResponseSchema,
  specFluidTabsResponseSchema,
  specFluidEvaluationSchema,
  describeIssues,
  type SpecFluidEvaluation,
  type SpecFluidTabResponse,
  type SpecFluidTabsResponse,
} from '@fluid/shared';
import { specFluidUrl } from './model';

/** Calls a Spec-Fluid route (GET unless `init` says otherwise) and validates its JSON; a Spec-Fluid error body becomes the message. */
async function getJson<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal, credentials: 'omit' });
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

/** Evaluates Smalltalk code with an entity as `self`. */
export const evaluate = (endpoint: string, id: string, code: string, signal?: AbortSignal): Promise<SpecFluidEvaluation> =>
  getJson(specFluidUrl(endpoint, 'entities', id, 'evaluate'), specFluidEvaluationSchema, signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

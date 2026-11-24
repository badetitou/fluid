import type { LlmConfig } from './types';

/**
 * Hosts whose OpenAI-compatible endpoint does not accept
 * `response_format: { type: 'json_object' }`. The prompt already asks for a
 * single JSON object and `extractJson` handles fences, so omitting the flag is
 * safe — it just avoids a wasted request on free tiers with tight quotas.
 */
const HOSTS_WITHOUT_JSON_MODE = [
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'openrouter.ai',
];

export function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return '';
  }
}

export function supportsJsonMode(config: LlmConfig): boolean {
  if (config.provider === 'mock' || config.provider === 'claude-code') return false;
  const host = hostnameOf(config.baseUrl);
  return !HOSTS_WITHOUT_JSON_MODE.some((known) => host === known || host.endsWith(`.${known}`));
}

/** A provider rejecting the JSON-mode flag itself, as opposed to a bad request. */
export function isJsonModeRejection(status: number, body: string): boolean {
  if (status !== 400 && status !== 422) return false;
  return /response_format|json_object|json schema|structured output/i.test(body);
}

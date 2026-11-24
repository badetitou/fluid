import type { ChatMessage, LlmConfig } from './types';
import { LlmError } from './errors';
import { isJsonModeRejection, supportsJsonMode } from './modelCapabilities';

// Pure response parsing lives in @fluid/shared so the browser runtime can reuse it.
export { extractJson, extractReasoning } from '@fluid/shared';

/**
 * Minimal client for the OpenAI-compatible Chat Completions API. Works for both
 * OpenAI (api.openai.com) and Ollama (localhost:11434/v1) since both expose the
 * same `/chat/completions` shape. Endpoints without a JSON response mode are
 * detected, and a rejected `response_format` triggers one retry without it.
 * `timeoutMs` bounds the whole call (no bound by default).
 */
export async function chatCompletion(
  config: LlmConfig,
  messages: ChatMessage[],
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;

  const send = async (jsonMode: boolean): Promise<Response> => {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw new LlmError(`The LLM at ${url} did not answer within ${timeoutMs! / 1000}s`);
      throw new LlmError(`Could not reach the LLM at ${url}: ${(err as Error).message}`);
    }
  };

  let res = await send(supportsJsonMode(config));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (!isJsonModeRejection(res.status, body)) {
      throw new LlmError(`LLM returned HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    // Some compatible APIs reject the flag but still follow the JSON prompt.
    res = await send(false);
    if (!res.ok) {
      const retryBody = await res.text().catch(() => '');
      throw new LlmError(
        `LLM returned HTTP ${res.status} after retrying without JSON mode: ${retryBody.slice(0, 500)}`,
      );
    }
  }

  const json = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[] }
    | null;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new LlmError('LLM response did not include any message content');
  }
  return content;
}

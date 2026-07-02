import type { ChatMessage, LlmConfig } from './types';
import { LlmError } from './errors';

/**
 * Extract reasoning steps from an LLM response that starts with "THINKING:"
 * Returns { reasoning: string[], content: string } where content is the remainder
 */
export function extractReasoning(text: string): { reasoning: string[]; content: string } {
  const lines = text.split('\n');
  const reasoning: string[] = [];
  let thinkingStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('THINKING:')) {
      thinkingStart = i;
      break;
    }
  }

  if (thinkingStart === -1) {
    return { reasoning: [], content: text };
  }

  let contentStart = thinkingStart + 1;
  for (let i = thinkingStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- ')) {
      reasoning.push(line.slice(2).trim());
    } else if (line.length > 0 && !line.startsWith('-')) {
      contentStart = i;
      break;
    }
  }

  const content = lines.slice(contentStart).join('\n');
  return { reasoning, content };
}

/**
 * Minimal client for the OpenAI-compatible Chat Completions API. Works for both
 * OpenAI (api.openai.com) and Ollama (localhost:11434/v1) since both expose the
 * same `/chat/completions` shape with a JSON response mode.
 */
export async function chatCompletion(config: LlmConfig, messages: ChatMessage[]): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    throw new LlmError(`Could not reach the LLM at ${url}: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`LLM returned HTTP ${res.status}: ${body.slice(0, 500)}`);
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

/**
 * Extract a JSON object from a model response that may be wrapped in prose or
 * ```json fences despite the JSON response mode.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to fence / brace extraction */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new LlmError('LLM response was not valid JSON');
}

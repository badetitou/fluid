import { LlmError } from './errors';

/**
 * Extract reasoning steps from an LLM response that starts with "THINKING:".
 * Returns { reasoning: string[], content: string } where content is the remainder.
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

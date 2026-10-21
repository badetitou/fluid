import type { RichTextFormat } from '@fluid/shared';
import { getPath } from '../../data';

// Pure logic of the richtext widget: reading the text and, for `auto`, telling
// Markdown from code.

export type ResolvedTextFormat = Exclude<RichTextFormat, 'auto'>;

/** The text a widget shows: the field of the bound object (several values are joined), or the binding itself. */
export function textOf(data: unknown, field?: string): string {
  const value = field ? getPath(Array.isArray(data) ? data[0] : data, field) : data;
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((v) => v != null && v !== '')
    .map((v) => (typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)))
    .join('\n\n');
}

const MARKDOWN_HINTS = [/^#{1,6}\s/m, /^\s*[-*+]\s+\S/m, /^\s*\d+\.\s+\S/m, /\[[^\]]+\]\([^)]+\)/, /\*\*[^*]+\*\*/, /^```/m, /^>\s/m, /\|.*\|\n\|\s*:?-+/];
const CODE_HINTS = [/[;{}]\s*$/m, /^\s*(import|export|from|def|class|function|const|let|var|return|public|private|package|SELECT|INSERT|CREATE)\b/im, /=>|::|\)\s*\{/];

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!/^[[{]/.test(t)) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

const score = (text: string, hints: RegExp[]) => hints.filter((re) => re.test(text)).length;

/** Markdown, code or plain text, judged from the text itself. */
export function detectTextFormat(text: string): ResolvedTextFormat {
  if (looksLikeJson(text)) return 'code';
  const markdown = score(text, MARKDOWN_HINTS);
  const code = score(text, CODE_HINTS);
  if (code >= 2 && code > markdown) return 'code';
  // Markdown is a superset of plain text: harmless when in doubt on a multi-line text.
  return markdown > 0 || text.includes('\n') ? 'markdown' : 'plain';
}

export function resolveFormat(text: string, format: RichTextFormat = 'auto'): ResolvedTextFormat {
  return format === 'auto' ? detectTextFormat(text) : format;
}

/** A code block language from a hint or the text; prism-react-renderer names. */
export function guessLanguage(text: string, hint?: string): string {
  if (hint) return hint.toLowerCase();
  const t = text.trim();
  if (looksLikeJson(t)) return 'json';
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|WITH)\b/i.test(t)) return 'sql';
  if (/^\s*(query|mutation|fragment|type|schema)\b[^=]*\{/m.test(t)) return 'graphql';
  if (/^\s*(def|from \S+ import|import \S+$)/m.test(t)) return 'python';
  if (/^\s*</.test(t)) return 'markup';
  if (/^[\w-]+:\s/m.test(t) && !/[;{}]/.test(t)) return 'yaml';
  return 'tsx';
}

/** Whether a CSS hex color is dark (picks the code theme matching the antd theme). */
export function isDarkColor(color: string): boolean {
  const hex = /^#?([\da-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

import type { ViewTextRange } from '@fluid/shared';

// The pure half of an Open Views text node: cutting its text around the
// highlighted ranges (an inspector tab selects its entity in a larger source).

/** A run of text, highlighted or not. */
export interface TextSegment {
  content: string;
  highlighted: boolean;
}

/**
 * The text cut into runs, in order: ranges are clamped to the text, sorted and
 * merged when they overlap; empty ones are dropped.
 */
export function textSegments(text: string, highlights: ViewTextRange[] = []): TextSegment[] {
  const ranges = highlights
    .map((r) => ({ start: Math.min(r.start, text.length), end: Math.min(r.end, text.length) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.end <= at) continue;
    const start = Math.max(range.start, at);
    if (start > at) segments.push({ content: text.slice(at, start), highlighted: false });
    segments.push({ content: text.slice(start, range.end), highlighted: true });
    at = range.end;
  }
  if (at < text.length || segments.length === 0) segments.push({ content: text.slice(at), highlighted: false });
  return segments;
}

// Pure logic of the code widget's diff: which lines were kept, removed or
// added between two versions, and which unchanged runs fold away.

export type RowKind = 'same' | 'removed' | 'added';

/** One line of the shown code: its text and its numbers in the old and new versions. */
export interface CodeRow {
  kind: RowKind;
  text: string;
  /** Line number in the older version (absent for added lines). */
  oldNo?: number;
  /** Line number in the shown version (absent for removed lines). */
  newNo?: number;
}

/** A folded run of unchanged rows, `from` to `to` (exclusive) in the row list. */
export interface FoldedRows {
  kind: 'fold';
  from: number;
  to: number;
}

export type RowItem = (CodeRow & { index: number }) | FoldedRows;

export const splitLines = (text: string): string[] => text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');

/** The rows of a single version: every line unchanged. */
export function plainRows(text: string): CodeRow[] {
  return splitLines(text).map((line, i) => ({ kind: 'same', text: line, oldNo: i + 1, newNo: i + 1 }));
}

// Above this many cells the LCS table gets too big: the middle is shown as
// replaced as a whole (common head and tail are still matched).
const MAX_CELLS = 4_000_000;

/** Longest common subsequence of two line lists, as matched index pairs. */
function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_CELLS) return [];
  // lengths[i * (m + 1) + j] = LCS length of a[i..] and b[j..]
  const lengths = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i * (m + 1) + j] =
        a[i] === b[j]
          ? lengths[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(lengths[(i + 1) * (m + 1) + j], lengths[i * (m + 1) + j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) pairs.push([i++, j++]);
    else if (lengths[(i + 1) * (m + 1) + j] >= lengths[i * (m + 1) + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Line diff from `before` to `after`: removed lines come before the lines that replace them. */
export function diffRows(before: string, after: string): CodeRow[] {
  const a = splitLines(before);
  const b = splitLines(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const pairs = lcsPairs(midA, midB).map(([i, j]): [number, number] => [i + head, j + head]);
  for (let k = 0; k < head; k++) pairs.unshift([head - 1 - k, head - 1 - k]);
  for (let k = tail; k > 0; k--) pairs.push([a.length - k, b.length - k]);

  const rows: CodeRow[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    for (; i < pi; i++) rows.push({ kind: 'removed', text: a[i], oldNo: i + 1 });
    for (; j < pj; j++) rows.push({ kind: 'added', text: b[j], newNo: j + 1 });
    if (pi < a.length) rows.push({ kind: 'same', text: a[pi], oldNo: ++i, newNo: ++j });
  }
  return rows;
}

/** Number of removed and added lines. */
export function diffStats(rows: CodeRow[]): { added: number; removed: number } {
  return {
    added: rows.filter((r) => r.kind === 'added').length,
    removed: rows.filter((r) => r.kind === 'removed').length,
  };
}

/**
 * The rows to draw: unchanged runs farther than `context` lines from any change
 * or kept row fold into one item. `keep` tells rows that must stay visible
 * (annotated lines, unfolded runs). Folding a single line is not worth it.
 */
export function foldRows(
  rows: CodeRow[],
  context: number,
  keep: (row: CodeRow, index: number) => boolean = () => false,
): RowItem[] {
  const visible = rows.map((r, i) => r.kind !== 'same' || keep(r, i));
  const near = visible.map((_, i) => {
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) if (visible[k]) return true;
    return false;
  });
  const items: RowItem[] = [];
  let i = 0;
  while (i < rows.length) {
    if (near[i]) {
      items.push({ ...rows[i], index: i });
      i++;
      continue;
    }
    let end = i;
    while (end < rows.length && !near[end]) end++;
    if (end - i > 1) items.push({ kind: 'fold', from: i, to: end });
    else items.push({ ...rows[i], index: i });
    i = end;
  }
  return items;
}

import type { HistoryWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { nodeLabel, type Row } from '../tree/treeModel';

export type { Row };

// Pure logic of the history widget: turns the bound rows into versions linked
// to their parents, ordered children first (see historyGraph.ts for the lanes).

export interface HistoryNode {
  /** The version's id, or its row index when it has none. */
  key: string;
  /** Ids of the parents, in order (the first one continues the lane). */
  parents: string[];
  label: string;
  row: Row;
  author?: string;
  avatar?: string;
  /** Epoch milliseconds, when the date parses. */
  time?: number;
  refs: string[];
}

type NodeOptions = Pick<
  HistoryWidget,
  'idField' | 'parentsField' | 'parentIdField' | 'labelField' | 'authorField' | 'avatarField' | 'dateField' | 'refsField'
>;

const ID_FIELDS = ['id', 'oid', 'sha', 'hash'];
const LABEL_FIELDS = ['message', 'messageHeadline', 'summary', 'comment'];

function scalar(value: unknown): string | undefined {
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

/** The id of a version or of a parent reference: the given field, else the usual id fields. */
export function idOf(value: unknown, field?: string): string | undefined {
  if (typeof value !== 'object' || value === null) return scalar(value);
  const fields = field ? [field] : ID_FIELDS;
  for (const f of fields) {
    const id = scalar(getPath(value, f));
    if (id !== undefined) return id;
  }
  return undefined;
}

/** Items of a list field, also reading GraphQL connections (`nodes` / `edges.node`). */
export function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return value == null ? [] : [value];
  const nodes = getPath(value, 'nodes');
  if (Array.isArray(nodes)) return nodes;
  const edges = getPath(value, 'edges');
  if (Array.isArray(edges)) return edges.map((edge) => getPath(edge, 'node'));
  return [value];
}

function timeOf(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function labelOf(row: Row, labelField?: string): string {
  if (labelField) return nodeLabel(row, labelField);
  for (const field of LABEL_FIELDS) {
    const text = scalar(getPath(row, field));
    if (text !== undefined) return text;
  }
  return nodeLabel(row);
}

/** One version per row; a row without an id is kept, keyed by its index. Duplicate ids are dropped. */
export function buildNodes(rows: Row[], opts: NodeOptions): HistoryNode[] {
  const seen = new Set<string>();
  const nodes: HistoryNode[] = [];
  rows.forEach((row, index) => {
    const key = idOf(row, opts.idField) ?? `#${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const parents = listOf(getPath(row, opts.parentsField)).flatMap((p) => idOf(p, opts.parentIdField) ?? []);
    const refs = opts.refsField
      ? listOf(getPath(row, opts.refsField)).flatMap((ref) => scalar(ref) ?? scalar(getPath(ref, 'name')) ?? [])
      : [];
    nodes.push({
      key,
      parents: [...new Set(parents)].filter((p) => p !== key),
      label: labelOf(row, opts.labelField),
      row,
      author: opts.authorField ? scalar(getPath(row, opts.authorField)) : undefined,
      avatar: opts.avatarField ? scalar(getPath(row, opts.avatarField)) : undefined,
      time: opts.dateField ? timeOf(getPath(row, opts.dateField)) : undefined,
      refs,
    });
  });
  return nodes;
}

/**
 * Orders the versions so that every child comes before its parents, which the
 * lanes need. Among the versions ready to be drawn, the newest comes first
 * (by date when known, else in the order of the rows). Cycles are broken.
 */
export function orderChildrenFirst(nodes: HistoryNode[]): HistoryNode[] {
  const index = new Map(nodes.map((n, i) => [n.key, i]));
  const pendingChildren = nodes.map(() => 0);
  for (const n of nodes) for (const p of n.parents) if (index.has(p)) pendingChildren[index.get(p)!]++;
  const rank = (i: number) => [nodes[i].time ?? -Infinity, -i] as const;
  const newer = (a: number, b: number) => {
    const [ta, ia] = rank(a);
    const [tb, ib] = rank(b);
    return ta !== tb ? ta > tb : ia > ib;
  };
  const done = nodes.map(() => false);
  const ready = nodes.flatMap((_, i) => (pendingChildren[i] === 0 ? [i] : []));
  const out: HistoryNode[] = [];
  while (out.length < nodes.length) {
    if (ready.length === 0) ready.push(done.findIndex((d) => !d)); // cycle: take the first left
    let best = 0;
    for (let r = 1; r < ready.length; r++) if (newer(ready[r], ready[best])) best = r;
    const i = ready.splice(best, 1)[0];
    if (done[i]) continue;
    done[i] = true;
    out.push(nodes[i]);
    for (const p of nodes[i].parents) {
      const pi = index.get(p);
      if (pi !== undefined && !done[pi] && --pendingChildren[pi] === 0) ready.push(pi);
    }
  }
  return out;
}

/** A short form of long ids (hashes): their first 7 characters. */
export function shortId(key: string): string {
  return /^[0-9a-f]{12,}$/i.test(key) ? key.slice(0, 7) : key;
}

/** Initials of an author, for the avatar placeholder. */
export function initials(name?: string): string {
  if (!name) return '?';
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)).toUpperCase();
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400e3],
  ['month', 30 * 86400e3],
  ['week', 7 * 86400e3],
  ['day', 86400e3],
  ['hour', 3600e3],
  ['minute', 60e3],
];
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });

/** How long ago a version was made: "3 days ago", "now". */
export function relativeTime(time: number, now = Date.now()): string {
  const elapsed = time - now;
  for (const [unit, ms] of UNITS) if (Math.abs(elapsed) >= ms) return relative.format(Math.round(elapsed / ms), unit);
  return 'now';
}

import type { DecoratedNode } from './graph';
import type { PropMatcher, Selector } from './schema';

// Does a node match a selector? Pure, cached regexes; tags are the ones the
// node has at this point of the evaluation (its own plus the concepts' so far).

const regexCache = new Map<string, RegExp | null>();

/** A regex from user text; `null` (never matches) when it does not compile. */
export function safeRegex(source: string): RegExp | null {
  if (!regexCache.has(source)) {
    try {
      regexCache.set(source, new RegExp(source));
    } catch {
      regexCache.set(source, null);
    }
  }
  return regexCache.get(source) ?? null;
}

/** `**` crosses folders, `*` and `?` stay within one. */
export function globToRegex(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return `^${out}$`;
}

/** A field of a node: `name`, `file`… or `props.a.b`. */
export function nodeField(node: DecoratedNode, path: string): unknown {
  const [head, ...rest] = path.split('.');
  let value: unknown = (node as Record<string, unknown>)[head];
  for (const part of rest) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const inList = (allowed: string | string[] | undefined, value: string | undefined) =>
  allowed === undefined || (value !== undefined && list(allowed).includes(value));

export function matchProp(value: unknown, matcher: PropMatcher): boolean {
  if (typeof matcher !== 'object') return value === matcher;
  const { eq, ne, gt, gte, lt, lte, regex, exists } = matcher;
  if (exists !== undefined && (value !== undefined && value !== null) !== exists) return false;
  if (eq !== undefined && value !== eq) return false;
  if (ne !== undefined && value === ne) return false;
  const n = typeof value === 'number' ? value : Array.isArray(value) ? value.length : undefined;
  const numeric = [gt, gte, lt, lte].some((x) => x !== undefined);
  if (numeric && n === undefined) return false;
  if (n !== undefined) {
    if (gt !== undefined && !(n > gt)) return false;
    if (gte !== undefined && !(n >= gte)) return false;
    if (lt !== undefined && !(n < lt)) return false;
    if (lte !== undefined && !(n <= lte)) return false;
  }
  if (regex !== undefined && !(typeof value === 'string' && safeRegex(regex)?.test(value)))
    return false;
  return true;
}

export function matchSelector(
  node: DecoratedNode,
  tags: ReadonlySet<string>,
  s: Selector,
): boolean {
  if (
    !inList(s.key, node.key) ||
    !inList(s.kind, node.kind) ||
    !inList(s.fineKind, node.fineKind)
  ) {
    return false;
  }
  if (!inList(s.language, node.language)) return false;
  if (s.external !== undefined && (node.external ?? false) !== s.external) return false;
  if (s.name !== undefined && !(node.name !== undefined && safeRegex(s.name)?.test(node.name)))
    return false;
  if (
    s.file !== undefined &&
    !(node.file !== undefined && safeRegex(globToRegex(s.file))?.test(node.file))
  ) {
    return false;
  }
  if (s.tag !== undefined && !list(s.tag).some((t) => tags.has(t))) return false;
  for (const [path, matcher] of Object.entries(s.props ?? {})) {
    if (!matchProp(nodeField(node, `props.${path}`), matcher)) return false;
  }
  if (s.not && matchSelector(node, tags, s.not)) return false;
  if (s.all && !s.all.every((x) => matchSelector(node, tags, x))) return false;
  if (s.any && !s.any.some((x) => matchSelector(node, tags, x))) return false;
  return true;
}

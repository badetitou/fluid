import type { Neighbours, PropMatcher, Selector } from './schema';
import { globToRegex } from './selector';

// A selector as a Cypher WHERE condition. Neighbour conditions become subqueries
// whose variables derive from the parent's (`n`, `n_1`, `n_1_1`…), so nested
// selectors never clash.

export const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
export const ident = (s: string) => `\`${s.replace(/`/g, '``')}\``;
const literal = (v: string | number | boolean) => (typeof v === 'string' ? quote(v) : String(v));
export const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
export const and = (parts: string[]) => (parts.length === 0 ? 'true' : parts.join(' AND '));

function inList(field: string, value: string | string[]): string {
  const values = list(value);
  return values.length === 1
    ? `${field} = ${quote(values[0])}`
    : `${field} IN [${values.map(quote).join(', ')}]`;
}

function propCypher(field: string, m: PropMatcher): string {
  if (typeof m !== 'object') return `${field} = ${literal(m)}`;
  const parts: string[] = [];
  if (m.exists !== undefined) parts.push(`${field} IS ${m.exists ? 'NOT ' : ''}NULL`);
  if (m.eq !== undefined) parts.push(`${field} = ${literal(m.eq)}`);
  if (m.ne !== undefined) parts.push(`${field} <> ${literal(m.ne)}`);
  for (const [op, sym] of [
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ] as const) {
    if (m[op] !== undefined) parts.push(`${field} ${sym} ${m[op]}`);
  }
  if (m.regex !== undefined) parts.push(`${field} =~ ${quote(`.*(?:${m.regex}).*`)}`);
  return and(parts);
}

export const relTypes = (via?: string[]) =>
  via && via.length > 0 ? `:${via.map(ident).join('|')}` : '';

/** `COUNT { … }` bounds on the neighbours of `v`, over out-edges or in-edges. */
function neighboursToCypher(n: Neighbours, v: string, direction: 'out' | 'in'): string {
  const w = `${v}_1`;
  const rel = relTypes(n.via);
  const pattern = direction === 'out' ? `(${v})-[${rel}]->(${w})` : `(${w})-[${rel}]->(${v})`;
  const count = `COUNT { ${pattern} WHERE ${selectorToCypher(n.match, w)} }`;
  return and([
    `${count} >= ${n.min ?? 1}`,
    ...(n.max !== undefined ? [`${count} <= ${n.max}`] : []),
  ]);
}

/** The WHERE condition of a selector on variable `v`. */
export function selectorToCypher(s: Selector, v: string): string {
  const parts: string[] = [];
  if (s.key !== undefined) parts.push(inList(`${v}.key`, s.key));
  if (s.kind !== undefined) parts.push(inList(`${v}.kind`, s.kind));
  if (s.fineKind !== undefined) parts.push(inList(`${v}.fineKind`, s.fineKind));
  if (s.language !== undefined) parts.push(inList(`${v}.language`, s.language));
  if (s.external !== undefined)
    parts.push(s.external ? `${v}.external = true` : `coalesce(${v}.external, false) = false`);
  if (s.name !== undefined) parts.push(`${v}.name =~ ${quote(`.*(?:${s.name}).*`)}`);
  if (s.file !== undefined) parts.push(`${v}.file =~ ${quote(globToRegex(s.file).slice(1, -1))}`);
  if (s.tag !== undefined) {
    const labels = list(s.tag).map((t) => `${v}:${ident(t)}`);
    parts.push(
      labels.length === 0 ? 'false' : labels.length === 1 ? labels[0] : `(${labels.join(' OR ')})`,
    );
  }
  for (const [path, m] of Object.entries(s.props ?? {}))
    parts.push(propCypher(`${v}.${ident(`props.${path}`)}`, m));
  if (s.not) parts.push(`NOT (${selectorToCypher(s.not, v)})`);
  if (s.all) parts.push(`(${and(s.all.map((x) => selectorToCypher(x, v)))})`);
  if (s.any) parts.push(`(${s.any.map((x) => selectorToCypher(x, v)).join(' OR ') || 'false'})`);
  if (s.has) parts.push(neighboursToCypher(s.has, v, 'out'));
  if (s.in) parts.push(neighboursToCypher(s.in, v, 'in'));
  if (s.parent)
    parts.push(
      `EXISTS { MATCH (${v}_1)-[:child]->(${v}) WHERE ${selectorToCypher(s.parent, `${v}_1`)} }`,
    );
  if (s.ancestor)
    parts.push(
      `EXISTS { MATCH (${v}_1)-[:child*1..]->(${v}) WHERE ${selectorToCypher(s.ancestor, `${v}_1`)} }`,
    );
  return and(parts);
}

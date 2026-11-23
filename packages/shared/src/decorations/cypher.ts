import type {
  Concept,
  Constraint,
  DecoratorSpec,
  DerivedEdge,
  PropMatcher,
  Selector,
} from './schema';
import { globToRegex } from './selector';

// The same decorators as openCypher queries. Not run by fluid today: it keeps
// the DSL within what a graph engine can execute, and documents each rule.
// Node fields are properties, tags are labels, edge kinds are relationship types.

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const ident = (s: string) => `\`${s.replace(/`/g, '``')}\``;
const literal = (v: string | number | boolean) => (typeof v === 'string' ? quote(v) : String(v));
const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const and = (parts: string[]) => (parts.length === 0 ? 'true' : parts.join(' AND '));

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

/** The WHERE condition of a selector on variable `v`. */
export function selectorToCypher(s: Selector, v: string): string {
  const parts: string[] = [];
  if (s.key !== undefined) parts.push(inList(`${v}.key`, s.key));
  if (s.kind !== undefined) parts.push(inList(`${v}.kind`, s.kind));
  if (s.fineKind !== undefined) parts.push(inList(`${v}.fineKind`, s.fineKind));
  if (s.language !== undefined) parts.push(inList(`${v}.language`, s.language));
  if (s.external !== undefined) parts.push(`${v}.external = ${s.external}`);
  if (s.name !== undefined) parts.push(`${v}.name =~ ${quote(`.*(?:${s.name}).*`)}`);
  if (s.file !== undefined) parts.push(`${v}.file =~ ${quote(globToRegex(s.file).slice(1, -1))}`);
  if (s.tag !== undefined) {
    const labels = list(s.tag).map((t) => `${v}:${ident(t)}`);
    parts.push(labels.length === 1 ? labels[0] : `(${labels.join(' OR ')})`);
  }
  for (const [path, m] of Object.entries(s.props ?? {}))
    parts.push(propCypher(`${v}.${ident(`props.${path}`)}`, m));
  if (s.not) parts.push(`NOT (${selectorToCypher(s.not, v)})`);
  if (s.all) parts.push(`(${and(s.all.map((x) => selectorToCypher(x, v)))})`);
  if (s.any) parts.push(`(${s.any.map((x) => selectorToCypher(x, v)).join(' OR ') || 'false'})`);
  return and(parts);
}

const relTypes = (via?: string[]) => (via && via.length > 0 ? `:${via.map(ident).join('|')}` : '');

export function conceptToCypher(c: Concept): string {
  const where = selectorToCypher(c.match, 'n');
  if (c.tag !== undefined) return `MATCH (n) WHERE ${where} SET n:${ident(c.tag)}`;
  const from = c.tagFrom!;
  return [
    `MATCH (n) WHERE ${where}`,
    `WITH n, apoc.text.regexGroups(n.${ident(from.field)}, ${quote(from.pattern)}) AS groups`,
    `WHERE size(groups) > 0`,
    `SET n:$(${quote(from.prefix ?? '')} + coalesce(groups[0][1], groups[0][0]))`,
  ].join(' ');
}

export function derivedToCypher(d: DerivedEdge): string {
  const value = (v: string, field: string) =>
    d.join.normalize === 'url'
      ? `fluid.normalizeUrl(${v}.${ident(field)})`
      : `${v}.${ident(field)}`;
  return (
    `MATCH (a), (b) WHERE ${selectorToCypher(d.from, 'a')} AND ${selectorToCypher(d.to, 'b')} ` +
    `AND ${value('a', d.join.from)} = ${value('b', d.join.to)} MERGE (a)-[:${ident(d.kind)}]->(b)`
  );
}

export function constraintToCypher(c: Constraint): string {
  const rel = relTypes(c.via);
  switch (c.check) {
    case 'node':
      return `MATCH (n) WHERE ${selectorToCypher(c.match, 'n')} RETURN n`;
    case 'forbidden':
      return c.reachable
        ? `MATCH (a)-[${rel}*1..]->(b) WHERE ${selectorToCypher(c.from, 'a')} AND ${selectorToCypher(c.to, 'b')} RETURN DISTINCT a, b`
        : `MATCH (a)-[r${rel}]->(b) WHERE ${selectorToCypher(c.from, 'a')} AND ${selectorToCypher(c.to, 'b')} RETURN a, r, b`;
    case 'required':
      return `MATCH (a) WHERE ${selectorToCypher(c.from, 'a')} AND NOT EXISTS { MATCH (a)-[${rel}]->(b) WHERE ${selectorToCypher(c.to, 'b')} } RETURN a`;
    case 'noCycle':
      return `MATCH p = (a)-[${rel}*1..]->(a) WHERE all(n IN nodes(p) WHERE ${selectorToCypher(c.among, 'n')}) RETURN p`;
  }
}

/** Every rule of a decorator, in evaluation order. */
export function decoratorToCypher(spec: DecoratorSpec): string[] {
  return [
    ...spec.concepts.map(conceptToCypher),
    ...spec.derived.map(derivedToCypher),
    ...spec.constraints.map(constraintToCypher),
  ];
}

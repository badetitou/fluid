import { ident, list, quote, relTypes, selectorToCypher } from './cypherSelector';
import type { Concept, Constraint, DecoratorSpec, DerivedEdge } from './schema';

export { selectorToCypher };

// The same decorators as openCypher queries. Not run by fluid today: it keeps
// the DSL within what a graph engine can execute, and documents each rule.
// Node fields are properties, tags are labels, edge kinds are relationship types.

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
  const froms = list(d.join.from);
  const tos = list(d.join.to);
  // A composite key: the fields agree pairwise, in order.
  const equalities = froms.map((f, i) => `${value('a', f)} = ${value('b', tos[i] ?? f)}`);
  return (
    `MATCH (a), (b) WHERE ${selectorToCypher(d.from, 'a')} AND ${selectorToCypher(d.to, 'b')} ` +
    `AND a <> b AND ${equalities.join(' AND ')} MERGE (a)-[:${ident(d.kind)}]->(b)`
  );
}

export function constraintToCypher(c: Constraint): string {
  const rel = relTypes(c.via);
  switch (c.check) {
    case 'node':
      return `MATCH (n) WHERE ${selectorToCypher(c.match, 'n')} RETURN n`;
    case 'forbidden':
      return c.reachable
        ? `MATCH (a)-[${rel}*1..]->(b) WHERE ${selectorToCypher(c.from, 'a')} AND ${selectorToCypher(c.to, 'b')} AND a <> b RETURN DISTINCT a, b`
        : `MATCH (a)-[r${rel}]->(b) WHERE ${selectorToCypher(c.from, 'a')} AND ${selectorToCypher(c.to, 'b')} RETURN a, r, b`;
    case 'required':
      return `MATCH (a) WHERE ${selectorToCypher(c.from, 'a')} AND NOT EXISTS { MATCH (a)-[${rel}]->(b) WHERE ${selectorToCypher(c.to, 'b')} } RETURN a`;
    case 'unreferenced':
      return `MATCH (n) WHERE ${selectorToCypher(c.match, 'n')} AND NOT EXISTS { MATCH ()-[${rel}]->(n) } RETURN n`;
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

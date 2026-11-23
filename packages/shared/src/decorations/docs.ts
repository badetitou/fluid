import type { Constraint, DecoratorSpec } from './schema';

// What the LLM is told about graph decorators: the language (to write one) and
// the active decorators (to use their tags and rules in a view). Prompts use
// these, never a hand-written description (CLAUDE.md, rule 5).

export const DECORATOR_LANGUAGE_DOC = `A graph decorator is JSON: { "id", "label", "description"?, "concepts"?, "derived"?, "constraints"? }.
Selector (all given fields must hold): { "key"?, "kind"?, "fineKind"?, "language"? (string or list), "name"? (regex),
  "file"? (glob, ** across folders), "external"? (boolean), "tag"? (has one of), "props"? ({ "a.b": value or
  { eq, ne, gt, gte, lt, lte, regex, exists } }; gt/lt on a list compare its length), "not"?, "all"?, "any"? }.
Concepts tag nodes: { "id", "match": Selector, "tag": "ui" } or { "id", "match", "tagFrom": { "field": "file",
  "pattern": "^services/([^/]+)/", "prefix"?: "service:" } } (first capture group). Later concepts see earlier tags.
Derived edges join nodes: { "id", "kind": "http", "from": Selector, "to": Selector,
  "join": { "from": "props.url", "to": "props.route", "normalize"?: "exact" | "url" } }.
Constraints give findings, each with "id", "message" ({source}, {target} are node names),
  "severity"? (error | warning | info, default warning), "via"? (edge kinds followed, default all):
  { "check": "node", "match" } every matching node is a finding;
  { "check": "forbidden", "from", "to", "reachable"? } no edge (or no path) from a "from" node to a "to" node;
  { "check": "required", "from", "to" } every "from" node has an edge to a "to" node;
  { "check": "noCycle", "among"? } no cycle among the matching nodes.`;

function describeConstraint(c: Constraint): string {
  return `    - ${c.id} (${c.severity}, ${c.check}): ${c.description ?? c.message}`;
}

/** The active decorators: the tags they set and the rules they check. */
export function renderDecoratorDocs(specs: DecoratorSpec[]): string {
  if (specs.length === 0) return '';
  const blocks = specs.map((spec) => {
    const tags = spec.concepts.map(
      (c) => c.tag ?? `${c.tagFrom?.prefix ?? ''}<${c.tagFrom?.field}>`,
    );
    return [
      `  - "${spec.id}" — ${spec.label}${spec.description ? `: ${spec.description}` : ''}`,
      ...(tags.length > 0 ? [`    tags: ${[...new Set(tags)].join(', ')}`] : []),
      ...(spec.derived.length > 0
        ? [`    derived edges: ${spec.derived.map((d) => d.kind).join(', ')}`]
        : []),
      ...spec.constraints.map(describeConstraint),
    ].join('\n');
  });
  return [
    'Active graph decorators (they tag nodes and flag findings on graph widgets):',
    ...blocks,
  ].join('\n');
}

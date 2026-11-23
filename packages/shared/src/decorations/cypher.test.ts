import { describe, expect, it } from 'vitest';
import {
  constraintToCypher,
  conceptToCypher,
  decoratorToCypher,
  derivedToCypher,
  selectorToCypher,
} from './cypher';
import { layersDecorator } from './presets';
import { conceptSchema, constraintSchema, derivedEdgeSchema } from './schema';

describe('Cypher translation', () => {
  it('translates selectors into WHERE conditions', () => {
    expect(selectorToCypher({}, 'n')).toBe('true');
    expect(
      selectorToCypher(
        { kind: ['CLASS', 'INTERFACE'], name: "^O'Neil", tag: 'ui', props: { loc: { gt: 100 } } },
        'n',
      ),
    ).toBe(
      "n.kind IN ['CLASS', 'INTERFACE'] AND n.name =~ '.*(?:^O\\'Neil).*' AND n:`ui` AND n.`props.loc` > 100",
    );
    expect(selectorToCypher({ file: 'src/**/*.ts', not: { external: true } }, 'a')).toBe(
      "a.file =~ 'src/(?:.*/)?[^/]*\\\\.ts' AND NOT (a.external = true)",
    );
  });

  it('translates concepts into SET label', () => {
    expect(
      conceptToCypher(conceptSchema.parse({ id: 'c', tag: 'ui', match: { file: 'web/**' } })),
    ).toBe("MATCH (n) WHERE n.file =~ 'web/.*' SET n:`ui`");
    expect(
      conceptToCypher(
        conceptSchema.parse({ id: 'c', tagFrom: { field: 'file', pattern: '^([^/]+)/' } }),
      ),
    ).toContain("apoc.text.regexGroups(n.`file`, '^([^/]+)/')");
  });

  it('translates each kind of constraint', () => {
    const c = (input: object) =>
      constraintToCypher(constraintSchema.parse({ id: 'r', message: 'm', ...input }));
    expect(c({ check: 'node', match: { kind: 'CLASS' } })).toBe(
      "MATCH (n) WHERE n.kind = 'CLASS' RETURN n",
    );
    expect(c({ check: 'forbidden', from: { tag: 'a' }, to: { tag: 'b' }, via: ['calls'] })).toBe(
      'MATCH (a)-[r:`calls`]->(b) WHERE a:`a` AND b:`b` RETURN a, r, b',
    );
    expect(c({ check: 'forbidden', reachable: true, from: { tag: 'a' }, to: { tag: 'b' } })).toBe(
      'MATCH (a)-[*1..]->(b) WHERE a:`a` AND b:`b` AND a <> b RETURN DISTINCT a, b',
    );
    expect(c({ check: 'required', from: { tag: 'a' }, to: { tag: 'b' } })).toBe(
      'MATCH (a) WHERE a:`a` AND NOT EXISTS { MATCH (a)-[]->(b) WHERE b:`b` } RETURN a',
    );
    expect(c({ check: 'noCycle', via: ['calls', 'references'] })).toBe(
      'MATCH p = (a)-[:`calls`|`references`*1..]->(a) WHERE all(n IN nodes(p) WHERE true) RETURN p',
    );
  });

  it('translates derived edges into MERGE', () => {
    const d = derivedEdgeSchema.parse({
      id: 'h',
      kind: 'http',
      from: { language: 'ts' },
      to: { language: 'java' },
      join: { from: 'props.url', to: 'props.route', normalize: 'url' },
    });
    expect(derivedToCypher(d)).toBe(
      "MATCH (a), (b) WHERE a.language = 'ts' AND b.language = 'java' AND a <> b AND fluid.normalizeUrl(a.`props.url`) = fluid.normalizeUrl(b.`props.route`) MERGE (a)-[:`http`]->(b)",
    );
  });

  it('gives one query per rule of a decorator', () => {
    const spec = layersDecorator({
      id: 'l',
      label: 'L',
      layers: [
        { tag: 'ui', match: {} },
        { tag: 'db', match: {} },
      ],
    });
    expect(decoratorToCypher(spec)).toHaveLength(3);
  });
});

describe('Cypher edge cases', () => {
  it('handles empty lists and external: false', () => {
    expect(selectorToCypher({ tag: [] }, 'n')).toBe('false');
    expect(selectorToCypher({ any: [] }, 'n')).toBe('(false)');
    expect(selectorToCypher({ external: false }, 'n')).toBe('coalesce(n.external, false) = false');
    expect(selectorToCypher({ external: true }, 'n')).toBe('n.external = true');
  });
});

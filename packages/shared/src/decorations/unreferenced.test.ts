import { describe, expect, it } from 'vitest';
import { constraintToCypher, derivedToCypher } from './cypher';
import { evaluateDecorators } from './evaluate';
import type { DecoratedGraph } from './graph';
import { constraintSchema, decoratorSpecSchema, derivedEdgeSchema } from './schema';

const run = (input: object, graph: DecoratedGraph) =>
  evaluateDecorators([decoratorSpecSchema.parse({ label: 't', ...input })], graph);
const flagged = (graph: DecoratedGraph, input: object, rule: string) =>
  run(input, graph)
    .decorations.filter((d) => d.findings.some((f) => f.ruleId === rule))
    .map((d) => d.target.key)
    .sort();

describe('unused import', () => {
  const file = (key: string, ...rest: object[]) => ({ file: key, ...Object.assign({}, ...rest) });
  const graph: DecoratedGraph = {
    nodes: [
      { key: 'imp-list', kind: 'Import', name: 'List', ...file('A.java') },
      { key: 'imp-map', kind: 'Import', name: 'Map', ...file('A.java') },
      { key: 'use-list', kind: 'Identifier', name: 'List', ...file('A.java') },
      // Same name, other file: does not count as a use of A.java's Map.
      { key: 'other-map', kind: 'Identifier', name: 'Map', ...file('B.java') },
      { key: 'no-file', kind: 'Identifier', name: 'Map' },
    ],
    edges: [],
  };
  const spec = {
    id: 'syntax',
    derived: [
      {
        id: 'uses',
        kind: 'uses',
        from: { kind: 'Identifier' },
        to: { kind: 'Import' },
        join: { from: ['file', 'name'], to: ['file', 'name'] },
      },
    ],
    constraints: [
      {
        id: 'unused-import',
        check: 'unreferenced',
        via: ['uses'],
        message: 'import {source} is never used',
        match: { kind: 'Import' },
      },
    ],
  };

  it('flags only the import with no use in its own file', () => {
    expect(flagged(graph, spec, 'unused-import')).toEqual(['imp-map']);
    const { derivedEdges, decorations } = run(spec, graph);
    expect(derivedEdges.map((e) => e.key)).toEqual(['use-list->imp-list:uses']);
    expect(decorations[0].findings[0].message).toBe('import Map is never used');
  });

  it('stays quiet when every import is used', () => {
    const used = {
      nodes: graph.nodes.filter((n) => n.key !== 'imp-map'),
      edges: [],
    };
    expect(flagged(used, spec, 'unused-import')).toEqual([]);
  });

  it('skips nodes missing a field and caps list-valued keys', () => {
    const noFile = { nodes: [{ key: 'i', kind: 'Import', name: 'X' }], edges: [] };
    expect(flagged(noFile, spec, 'unused-import')).toEqual(['i']);
    const many = Array.from({ length: 150 }, (_, i) => `v${i}`);
    const wide = {
      nodes: [
        { key: 'a', kind: 'Identifier', file: 'f', props: { names: many } },
        { key: 'b', kind: 'Import', file: 'f', props: { names: ['v0', 'v149'] } },
      ],
      edges: [],
    };
    const wideSpec = {
      id: 'w',
      derived: [
        {
          id: 'uses',
          kind: 'uses',
          from: { kind: 'Identifier' },
          to: { kind: 'Import' },
          join: { from: ['file', 'props.names'], to: ['file', 'props.names'] },
        },
      ],
    };
    // v0 is within the first 100 keys of `a`, v149 is not: one edge, not two.
    expect(run(wideSpec, wide).derivedEdges).toHaveLength(1);
  });
});

describe('private method never called', () => {
  const method = (key: string, isPrivate: boolean) => ({
    key,
    kind: 'Method',
    name: key,
    props: { private: isPrivate },
  });
  const graph: DecoratedGraph = {
    nodes: [
      method('used', true),
      method('dead', true),
      method('api', false),
      method('caller', false),
    ],
    edges: [
      { from: 'caller', to: 'used', kind: 'calls' },
      { from: 'caller', to: 'dead', kind: 'extends' },
    ],
  };
  const spec = {
    id: 'syntax',
    constraints: [
      {
        id: 'unused-private-method',
        check: 'unreferenced',
        via: ['calls'],
        message: 'private method {source} is never called',
        match: { kind: 'Method', props: { private: true } },
      },
    ],
  };

  it('flags the private method nobody calls, counting only the via kinds', () => {
    expect(flagged(graph, spec, 'unused-private-method')).toEqual(['dead']);
  });

  it('stays quiet once it is called', () => {
    const fine = {
      ...graph,
      edges: [...graph.edges, { from: 'caller', to: 'dead', kind: 'calls' }],
    };
    expect(flagged(fine, spec, 'unused-private-method')).toEqual([]);
  });
});

describe('unreferenced as Cypher', () => {
  it('translates the check', () => {
    const c = constraintSchema.parse({
      id: 'r',
      check: 'unreferenced',
      message: 'm',
      via: ['uses'],
      match: { kind: 'Import' },
    });
    expect(constraintToCypher(c)).toBe(
      "MATCH (n) WHERE n.kind = 'Import' AND NOT EXISTS { MATCH ()-[:`uses`]->(n) } RETURN n",
    );
    expect(constraintToCypher({ ...c, via: undefined })).toContain(
      'NOT EXISTS { MATCH ()-[]->(n) }',
    );
  });

  it('translates a composite join as an AND of equalities', () => {
    const d = derivedEdgeSchema.parse({
      id: 'u',
      kind: 'uses',
      from: { kind: 'Identifier' },
      to: { kind: 'Import' },
      join: { from: ['file', 'name'], to: ['file', 'name'] },
    });
    expect(derivedToCypher(d)).toBe(
      "MATCH (a), (b) WHERE a.kind = 'Identifier' AND b.kind = 'Import' AND a <> b AND a.`file` = b.`file` AND a.`name` = b.`name` MERGE (a)-[:`uses`]->(b)",
    );
  });
});

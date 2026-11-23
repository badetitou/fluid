import { describe, expect, it } from 'vitest';
import { ast, astGraph, ifStmt, type AstNode } from './astFixture';
import { selectorToCypher } from './cypher';
import { evaluateDecorators } from './evaluate';
import { decoratorSpecSchema, selectorSchema, type Selector } from './schema';
import { createMatchContext, matchSelector } from './selector';

// Syntax-tree rules (neutral ids) on a small Java AST, as graph decorators.

const CHILD = ['child'];
const anyChild = (match: Selector = {}, bounds: { min?: number; max?: number } = {}) => ({
  has: { via: CHILD, match, ...bounds },
});
const noChild = (match: Selector = {}) => anyChild(match, { max: 0 });
const noElse = noChild({ kind: 'Else' });

const rules: Record<string, Selector> = {
  'java-notify-all': {
    kind: 'MethodInvocation',
    name: '^notify$',
    has: { via: CHILD, match: { kind: 'Expression' }, max: 0 },
  },
  'empty-catch': { kind: 'CatchClause', ...anyChild({ kind: 'Block', ...noChild() }) },
  'collapsible-if': {
    all: [
      { kind: 'If' },
      noElse,
      anyChild({
        kind: 'Block',
        all: [anyChild({}, { max: 1 }), anyChild({ kind: 'If', ...noElse })],
      }),
    ],
  },
  'lonely-else-if': {
    kind: 'Else',
    all: [anyChild({}, { max: 1 }), anyChild({ kind: 'If' })],
  },
  'return-in-finally': { kind: 'Return', ancestor: { kind: 'Finally' } },
};

const flagged = (graph: ReturnType<typeof astGraph>, ruleId: string): string[] => {
  const spec = decoratorSpecSchema.parse({
    id: 'syntax',
    label: 'Syntax',
    constraints: [{ id: ruleId, check: 'node', message: 'm', match: rules[ruleId] }],
  });
  return evaluateDecorators([spec], graph)
    .decorations.filter((d) => d.findings.some((f) => f.ruleId === ruleId))
    .map((d) => d.target.key)
    .sort();
};

const call = (key: string, name: string, ...args: AstNode[]) =>
  ast('MethodInvocation', { key, name }, ...args);

describe('syntax-tree rules', () => {
  it('java-notify-all: notify() with no argument', () => {
    const bad = astGraph(call('bad', 'notify'), call('ok', 'notify', ast('Expression')));
    expect(flagged(bad, 'java-notify-all')).toEqual(['bad']);
    expect(
      flagged(
        astGraph(call('ok', 'notify', ast('Expression')), call('w', 'wait')),
        'java-notify-all',
      ),
    ).toEqual([]);
  });

  it('empty-catch: a catch whose block has no statement', () => {
    const graph = astGraph(
      ast('CatchClause', { key: 'empty' }, ast('Block')),
      ast('CatchClause', { key: 'full' }, ast('Block', {}, ast('Statement'))),
    );
    expect(flagged(graph, 'empty-catch')).toEqual(['empty']);
    expect(
      flagged(
        astGraph(ast('CatchClause', { key: 'c' }, ast('Block', {}, ast('Statement')))),
        'empty-catch',
      ),
    ).toEqual([]);
  });

  it('collapsible-if: an if holding only an if, without else', () => {
    const graph = astGraph(
      ifStmt('bad', [ifStmt('inner', [ast('Statement')])]),
      ifStmt('two', [ifStmt('i2', [ast('Statement')]), ast('Statement')]),
      ifStmt('withElse', [ifStmt('i3', [ast('Statement')])], [ast('Statement')]),
      ifStmt('innerElse', [ifStmt('i4', [ast('Statement')], [ast('Statement')])]),
    );
    expect(flagged(graph, 'collapsible-if')).toEqual(['bad']);
    expect(flagged(astGraph(ifStmt('fine', [ast('Statement')])), 'collapsible-if')).toEqual([]);
  });

  it('lonely-else-if: an else holding only an if', () => {
    const graph = astGraph(
      ifStmt('a', [ast('Statement')], [ifStmt('chained', [ast('Statement')])]),
      ifStmt('b', [ast('Statement')], [ast('Statement')]),
      ifStmt('c', [ast('Statement')], [ifStmt('d', []), ast('Statement')]),
    );
    expect(flagged(graph, 'lonely-else-if')).toEqual(['a-else']);
    expect(flagged(astGraph(ifStmt('fine', [ast('Statement')])), 'lonely-else-if')).toEqual([]);
  });

  it('return-in-finally: a return anywhere under a finally', () => {
    const graph = astGraph(
      ast(
        'Try',
        {},
        ast('Block', {}, ast('Return', { key: 'in-try' })),
        ast('Finally', {}, ast('Block', {}, ifStmt('i', [ast('Return', { key: 'deep' })]))),
      ),
    );
    expect(flagged(graph, 'return-in-finally')).toEqual(['deep']);
    const fine = astGraph(
      ast('Try', {}, ast('Block', {}, ast('Return')), ast('Finally', {}, ast('Block'))),
    );
    expect(flagged(fine, 'return-in-finally')).toEqual([]);
  });
});

describe('structural selectors', () => {
  const graph = astGraph(
    ast('Class', { key: 'c' }, ast('Method', { key: 'm' }, ast('Block', { key: 'b' }))),
  );
  const ctx = createMatchContext(graph.nodes, graph.edges, () => new Set(), true);
  const at = (key: string, s: Selector) =>
    matchSelector(
      graph.nodes.find((n) => n.key === key)!,
      ctx,
      s,
    );

  it('parent looks at the incoming child edge only', () => {
    expect(at('b', { parent: { kind: 'Method' } })).toBe(true);
    expect(at('b', { parent: { kind: 'Class' } })).toBe(false);
    expect(at('c', { parent: {} })).toBe(false);
  });

  it('ancestor goes up the whole chain', () => {
    expect(at('b', { ancestor: { kind: 'Class' } })).toBe(true);
    expect(at('c', { ancestor: { kind: 'Class' } })).toBe(false);
  });

  it('ancestor terminates on a cycle', () => {
    const cyclic = astGraph(ast('A', { key: 'a' }, ast('B', { key: 'b' })));
    cyclic.edges.push({ from: 'b', to: 'a', kind: 'child' });
    const c = createMatchContext(cyclic.nodes, cyclic.edges, () => new Set(), true);
    expect(matchSelector(cyclic.nodes[1], c, { ancestor: { kind: 'Nope' } })).toBe(false);
    expect(matchSelector(cyclic.nodes[1], c, { ancestor: { kind: 'A' } })).toBe(true);
  });

  it('has and in count neighbours over the given edge kinds', () => {
    const g = {
      nodes: [{ key: 'x' }, { key: 'y', kind: 'T' }, { key: 'z', kind: 'T' }],
      edges: [
        { from: 'x', to: 'y', kind: 'uses' },
        { from: 'x', to: 'z', kind: 'calls' },
      ],
    };
    const c = createMatchContext(g.nodes, g.edges, () => new Set(), true);
    const x = g.nodes[0];
    expect(matchSelector(x, c, { has: { match: { kind: 'T' }, min: 2 } })).toBe(true);
    expect(matchSelector(x, c, { has: { via: ['uses'], match: { kind: 'T' }, min: 2 } })).toBe(
      false,
    );
    expect(matchSelector(x, c, { has: { via: ['uses'], match: { kind: 'T' }, max: 1 } })).toBe(
      true,
    );
    expect(matchSelector(g.nodes[1], c, { in: { via: ['uses'], match: { key: 'x' } } })).toBe(true);
    expect(matchSelector(g.nodes[1], c, { in: { via: ['calls'], match: {} } })).toBe(false);
  });

  it('min defaults to 0 when max is 0, and an explicit min 1 with max 0 never matches', () => {
    const g = { nodes: [{ key: 'x' }, { key: 'y' }], edges: [{ from: 'x', to: 'y', kind: 'k' }] };
    const c = createMatchContext(g.nodes, g.edges, () => new Set(), true);
    expect(matchSelector(g.nodes[1], c, { has: { match: {}, max: 0 } })).toBe(true);
    expect(matchSelector(g.nodes[0], c, { has: { match: {}, max: 0 } })).toBe(false);
    expect(matchSelector(g.nodes[1], c, { has: { match: {}, min: 1, max: 0 } })).toBe(false);
    expect(matchSelector(g.nodes[0], c, { has: { match: {}, min: 1, max: 0 } })).toBe(false);
  });

  it('rejects min above max', () => {
    expect(selectorSchema.safeParse({ has: { match: {}, min: 2, max: 1 } }).success).toBe(false);
    expect(selectorSchema.safeParse({ in: { match: {}, min: 1, max: 1 } }).success).toBe(true);
  });

  it('validates the new fields with the schema', () => {
    expect(
      selectorSchema.safeParse({ has: { match: {}, max: 0 }, ancestor: { in: { match: {} } } })
        .success,
    ).toBe(true);
    expect(selectorSchema.safeParse({ has: { max: 0 } }).success).toBe(false);
  });
});

describe('structural selectors as Cypher', () => {
  it('translates has and in into COUNT bounds', () => {
    expect(
      selectorToCypher({ has: { via: ['child'], match: { kind: 'Expression' }, max: 0 } }, 'n'),
    ).toBe(
      "COUNT { (n)-[:`child`]->(n_1) WHERE n_1.kind = 'Expression' } >= 0 AND COUNT { (n)-[:`child`]->(n_1) WHERE n_1.kind = 'Expression' } <= 0",
    );
    expect(selectorToCypher({ in: { match: {} } }, 'n')).toBe(
      'COUNT { (n_1)-[]->(n) WHERE true } >= 1',
    );
  });

  it('translates parent and ancestor into EXISTS', () => {
    expect(selectorToCypher({ parent: { kind: 'Method' } }, 'n')).toBe(
      "EXISTS { MATCH (n_1)-[:child]->(n) WHERE n_1.kind = 'Method' }",
    );
    expect(selectorToCypher({ ancestor: { kind: 'Finally' } }, 'n')).toBe(
      "EXISTS { MATCH (n_1)-[:child*1..1000]->(n) WHERE n_1.kind = 'Finally' }",
    );
  });

  it('uses fresh variables when nested', () => {
    expect(selectorToCypher({ parent: { ancestor: { kind: 'A' } } }, 'n')).toBe(
      "EXISTS { MATCH (n_1)-[:child]->(n) WHERE EXISTS { MATCH (n_1_1)-[:child*1..1000]->(n_1) WHERE n_1_1.kind = 'A' } }",
    );
  });
});

describe('concept pass', () => {
  it('does not memoize: a selector is re-evaluated after another concept adds a tag', () => {
    // The same selector object is used before and after tag "a" appears.
    const needsA: Selector = { tag: 'a' };
    const spec = decoratorSpecSchema.parse({ id: 'd', label: 'D' });
    const tagged = {
      ...spec,
      concepts: [
        { id: 'early', match: needsA, tag: 'early' },
        { id: 'give-a', match: {}, tag: 'a' },
        { id: 'late', match: needsA, tag: 'late' },
      ],
    };
    const result = evaluateDecorators([tagged], { nodes: [{ key: 'n' }], edges: [] });
    expect(result.decorations[0].tags).toEqual(['a', 'late']);
  });
});

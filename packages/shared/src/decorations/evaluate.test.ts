import { describe, expect, it } from 'vitest';
import type { DecoratedGraph, Decoration } from './graph';
import { evaluateDecorators } from './evaluate';
import { layersDecorator, noCyclesDecorator } from './presets';
import {
  constraintSchema,
  decoratorSpecSchema,
  type DecoratorSpec,
  type DecoratorSpecInput,
} from './schema';
import { globToRegex, matchProp, matchSelector } from './selector';
import { MAX_DERIVED_PER_RULE, normalizeUrl } from './derive';

const spec = (input: Omit<DecoratorSpecInput, 'label'>) =>
  decoratorSpecSchema.parse({ label: 'test', ...input });
const node = (decorations: Decoration[], key: string) =>
  decorations.find((d) => d.target.type === 'node' && d.target.key === key);
const ruleIds = (d?: Decoration) => d?.findings.map((f) => f.ruleId) ?? [];

const app: DecoratedGraph = {
  nodes: [
    { key: 'UserPage', kind: 'CLASS', name: 'UserPage', file: 'web/src/pages/UserPage.ts' },
    {
      key: 'UserService',
      kind: 'CLASS',
      name: 'UserService',
      file: 'core/src/domain/UserService.java',
    },
    { key: 'UserRepo', kind: 'CLASS', name: 'UserRepo', file: 'core/src/infra/UserRepo.java' },
    {
      key: 'Audit',
      kind: 'CLASS',
      name: 'Audit',
      file: 'core/src/infra/Audit.java',
      props: { methods: [1, 2, 3] },
    },
  ],
  edges: [
    { from: 'UserPage', to: 'UserService', kind: 'calls' },
    { from: 'UserService', to: 'UserRepo', kind: 'calls' },
    { from: 'UserRepo', to: 'UserService', kind: 'references' },
    { from: 'Audit', to: 'UserPage', kind: 'calls' },
  ],
};

const layers = layersDecorator({
  id: 'layers',
  label: 'Layers',
  layers: [
    { tag: 'ui', match: { file: 'web/**' } },
    { tag: 'domain', match: { file: '**/domain/**' } },
    { tag: 'infra', match: { file: '**/infra/*.java' } },
  ],
});

describe('selectors', () => {
  it('turns globs into anchored regexes', () => {
    expect(new RegExp(globToRegex('**/infra/*.java')).test('core/src/infra/A.java')).toBe(true);
    expect(new RegExp(globToRegex('**/infra/*.java')).test('core/src/infra/sub/A.java')).toBe(
      false,
    );
    expect(new RegExp(globToRegex('web/**')).test('web/a/b.ts')).toBe(true);
  });

  it('combines fields, props, not/any and tags', () => {
    const audit = app.nodes[3];
    expect(matchSelector(audit, new Set(), { kind: 'CLASS', props: { methods: { gt: 2 } } })).toBe(
      true,
    );
    expect(matchSelector(audit, new Set(), { props: { methods: { gt: 3 } } })).toBe(false);
    expect(
      matchSelector(audit, new Set(['infra']), { tag: ['ui', 'infra'], not: { name: '^User' } }),
    ).toBe(true);
    expect(matchSelector(audit, new Set(), { any: [{ name: 'X' }, { name: 'Aud' }] })).toBe(true);
    expect(matchSelector(audit, new Set(), { name: '(' })).toBe(false);
  });
});

describe('evaluateDecorators', () => {
  it('tags layers and flags an upward dependency on the edge and its source', () => {
    const { decorations } = evaluateDecorators([layers], app);
    expect(node(decorations, 'UserPage')?.tags).toEqual(['ui']);
    expect(node(decorations, 'Audit')?.tags).toEqual(['infra']);
    expect(ruleIds(node(decorations, 'Audit'))).toEqual(['layer-2-upward']);
    expect(ruleIds(node(decorations, 'UserRepo'))).toEqual(['layer-2-upward']);
    const edge = decorations.find((d) => d.target.key === 'Audit->UserPage:calls');
    expect(edge?.findings[0]).toMatchObject({
      severity: 'error',
      message: 'Audit (infra) depends on UserPage, in an upper layer',
    });
    expect(ruleIds(node(decorations, 'UserService'))).toEqual([]);
  });

  it('follows only the edge kinds of "via"', () => {
    const callsOnly = layersDecorator({
      ...layers,
      layers: [
        { tag: 'domain', match: { file: '**/domain/**' } },
        { tag: 'infra', match: { file: '**/infra/*.java' } },
      ],
      via: ['calls'],
    });
    expect(ruleIds(node(evaluateDecorators([callsOnly], app).decorations, 'UserRepo'))).toEqual([]);
  });

  it('finds cycles, with every node and edge of the cycle', () => {
    const { decorations } = evaluateDecorators(
      [noCyclesDecorator({ id: 'cycles', label: 'Cycles' })],
      app,
    );
    const cycle = node(decorations, 'UserService')?.findings[0];
    expect(cycle?.related).toEqual(['UserRepo', 'UserService']);
    expect(cycle?.message).toBe('UserService is on a dependency cycle');
    expect(node(decorations, 'UserRepo')?.findings[0].message).toBe(
      'UserRepo is on a dependency cycle',
    );
    expect(
      decorations
        .filter((d) => d.target.type === 'edge')
        .map((d) => d.target.key)
        .sort(),
    ).toEqual(['UserRepo->UserService:references', 'UserService->UserRepo:calls']);
  });

  it('reports a forbidden path when reachable, once per source', () => {
    const rule = spec({
      id: 'no-ui-to-infra',
      constraints: [
        {
          id: 'ui-infra',
          check: 'forbidden',
          reachable: true,
          message: '{source} reaches {target}',
          from: { file: 'web/**' },
          to: { name: 'Repo$' },
        },
      ],
    });
    const found = node(evaluateDecorators([rule], app).decorations, 'UserPage')?.findings;
    expect(found).toEqual([
      {
        decoratorId: 'no-ui-to-infra',
        ruleId: 'ui-infra',
        severity: 'warning',
        message: 'UserPage reaches UserRepo',
        related: ['UserRepo'],
      },
    ]);
  });

  it('checks node and required rules on tags from another decorator', () => {
    const rules = spec({
      id: 'rules',
      constraints: [
        {
          id: 'big',
          check: 'node',
          severity: 'info',
          message: '{source} is big',
          match: { props: { methods: { gte: 3 } } },
        },
        {
          id: 'domain-needs-infra',
          check: 'required',
          message: '{source} has no infra',
          via: ['calls'],
          from: { tag: 'domain' },
          to: { tag: 'ui' },
        },
      ],
    });
    const { decorations } = evaluateDecorators([layers, rules], app);
    expect(node(decorations, 'Audit')?.findings.map((f) => f.message)).toContain('Audit is big');
    expect(ruleIds(node(decorations, 'UserService'))).toEqual(['domain-needs-infra']);
  });

  it('tags from a field with a capture group (services)', () => {
    const services = spec({
      id: 'services',
      concepts: [
        { id: 'svc', tagFrom: { field: 'file', pattern: '^([^/]+)/', prefix: 'service:' } },
      ],
    });
    const { decorations } = evaluateDecorators([services], app);
    expect(node(decorations, 'UserPage')?.tags).toEqual(['service:web']);
    expect(node(decorations, 'Audit')?.tags).toEqual(['service:core']);
  });

  it('derives front-end to back-end edges from URLs, and rules run on them', () => {
    const graph: DecoratedGraph = {
      nodes: [
        {
          key: 'fetchUser',
          language: 'typescript',
          props: { url: 'https://api.example.com/api/users/${id}?full=1' },
        },
        { key: 'getUser', language: 'java', props: { route: '/api/users/{id}' } },
        { key: 'deleteAll', language: 'java', tags: ['admin'], props: { route: '/admin/purge' } },
        { key: 'purge', language: 'typescript', props: { url: '/admin/purge/' } },
      ],
      edges: [],
    };
    const tracing = spec({
      id: 'http',
      derived: [
        {
          id: 'http',
          kind: 'http',
          from: { language: 'typescript' },
          to: { language: 'java' },
          join: { from: 'props.url', to: 'props.route', normalize: 'url' },
        },
      ],
      constraints: [
        {
          id: 'no-admin',
          check: 'forbidden',
          severity: 'error',
          message: '{source} calls admin {target}',
          via: ['http'],
          from: {},
          to: { tag: 'admin' },
        },
      ],
    });
    const { derivedEdges, decorations } = evaluateDecorators([tracing], graph);
    expect(derivedEdges.map((e) => e.key)).toEqual([
      'fetchUser->getUser:http',
      'purge->deleteAll:http',
    ]);
    expect(node(decorations, 'purge')?.findings[0].message).toBe('purge calls admin deleteAll');
  });

  it('normalizes URLs and routes the same way', () => {
    expect(normalizeUrl('http://h:8080/Api/users/42/?x=1')).toBe('/api/users/*');
    expect(normalizeUrl('/api/users/:id')).toBe('/api/users/*');
  });

  it('rejects a concept with both or neither of tag and tagFrom', () => {
    expect(() => spec({ id: 'x', concepts: [{ id: 'c', match: {} }] })).toThrow();
  });
});

const g = (edges: [string, string, string?][], keys = ['a', 'b', 'c', 'd']): DecoratedGraph => ({
  nodes: keys.map((key) => ({ key })),
  edges: edges.map(([from, to, kind]) => ({ from, to, kind })),
});
const cyclesOf = (graph: DecoratedGraph) =>
  evaluateDecorators([noCyclesDecorator({ id: 'cy', label: 'C' })], graph)
    .decorations.filter((d) => d.target.type === 'node')
    .map((d) => d.findings[0].related);

describe('cycles', () => {
  it('finds a self-loop', () => {
    expect(cyclesOf(g([['a', 'a']]))).toEqual([['a']]);
  });

  it('finds two separate cycles', () => {
    const found = cyclesOf(
      g([
        ['a', 'b'],
        ['b', 'a'],
        ['c', 'd'],
        ['d', 'c'],
      ]),
    );
    expect(found.map((r) => r?.join(',')).sort()).toEqual(['a,b', 'a,b', 'c,d', 'c,d']);
  });

  it('keeps findings over the allowed kind with via', () => {
    const rule = noCyclesDecorator({ id: 'cy', label: 'C', via: ['calls'] });
    const graph = g([
      ['a', 'b', 'calls'],
      ['b', 'a', 'calls'],
      ['c', 'd', 'refs'],
      ['d', 'c', 'refs'],
    ]);
    const keys = evaluateDecorators([rule], graph).decorations.map((d) => d.target.key);
    expect(keys).toContain('a');
    expect(keys).not.toContain('c');
  });
});

describe('forbidden', () => {
  const forbid = (extra: object = {}) =>
    spec({
      id: 'f',
      constraints: [
        {
          id: 'r',
          check: 'forbidden',
          message: '{source}->{target}',
          from: { key: 'a' },
          to: { key: ['b', 'c'] },
          ...extra,
        },
      ],
    });

  it('gives one node finding per source, listing every target; edges get one each', () => {
    const { decorations } = evaluateDecorators(
      [forbid()],
      g([
        ['a', 'b'],
        ['a', 'c'],
      ]),
    );
    expect(node(decorations, 'a')?.findings).toHaveLength(1);
    expect(node(decorations, 'a')?.findings[0].related).toEqual(['b', 'c']);
    expect(decorations.filter((d) => d.target.type === 'edge')).toHaveLength(2);
  });

  it('gives no finding when reachable finds no path', () => {
    const { decorations } = evaluateDecorators([forbid({ reachable: true })], g([['b', 'a']]));
    expect(decorations).toEqual([]);
  });
});

describe('decorator ordering and layers', () => {
  it('sees tags when the rules decorator is listed before the layers', () => {
    const rules = spec({
      id: 'rules',
      constraints: [{ id: 'k', check: 'node', message: 'm', match: { tag: 'ui' } }],
    });
    const { decorations } = evaluateDecorators([rules, layers], app);
    expect(ruleIds(node(decorations, 'UserPage'))).toEqual(['k']);
  });

  it('supports a layer tag containing ":"', () => {
    const l = layersDecorator({
      id: 'l',
      label: 'L',
      layers: [
        { tag: 'ui:front', match: { key: 'a' } },
        { tag: 'ui:back', match: { key: 'b' } },
      ],
    });
    const { decorations } = evaluateDecorators([l], g([['b', 'a']]));
    expect(node(decorations, 'a')?.tags).toEqual(['ui:front']);
    expect(ruleIds(node(decorations, 'b'))).toEqual(['layer-1-upward']);
  });

  it('records only the tags a node did not already have', () => {
    const graph: DecoratedGraph = { nodes: [{ key: 'a', tags: ['ui'] }], edges: [] };
    const t = spec({
      id: 't',
      concepts: [
        { id: 'c', tag: 'ui' },
        { id: 'd', tag: 'x' },
      ],
    });
    expect(node(evaluateDecorators([t], graph).decorations, 'a')?.tags).toEqual(['x']);
  });
});

describe('derived edges', () => {
  const http = (normalize: 'exact' | 'url') =>
    spec({
      id: 'h',
      derived: [
        {
          id: 'h',
          kind: 'http',
          from: { key: 'x' },
          to: { key: 'y' },
          join: { from: 'props.u', to: 'props.r', normalize },
        },
      ],
    });
  const pair = (u: unknown, r: unknown): DecoratedGraph => ({
    nodes: [
      { key: 'x', props: { u } },
      { key: 'y', props: { r } },
    ],
    edges: [],
  });
  const derived = (s: DecoratorSpec[], graph: DecoratedGraph) =>
    evaluateDecorators(s, graph).derivedEdges;

  it('normalizes more URL shapes', () => {
    expect(normalizeUrl('/a/${id}')).toBe('/a/*');
    expect(normalizeUrl('/a/<id>/b')).toBe('/a/*/b');
    expect(normalizeUrl('https://host')).toBe('/');
    expect(normalizeUrl('')).toBe('/');
    expect(normalizeUrl('/a/b#frag')).toBe('/a/b');
  });

  it('joins exactly', () => {
    expect(derived([http('exact')], pair('/a/1', '/a/1'))).toHaveLength(1);
    expect(derived([http('exact')], pair('/a/1', '/a/2'))).toHaveLength(0);
  });

  it('does not join empty values, or a bare host', () => {
    expect(derived([http('exact')], pair('', ''))).toEqual([]);
    expect(derived([http('exact')], pair('  ', '  '))).toEqual([]);
    expect(derived([http('url')], pair('', ''))).toEqual([]);
    expect(derived([http('url')], pair('https://host', '/'))).toEqual([]);
    expect(derived([http('url')], pair('/', '/'))).toHaveLength(1);
  });

  it('never duplicates an existing edge, across rules or decorators', () => {
    const graph = { ...pair('/a', '/a'), edges: [{ from: 'x', to: 'y', kind: 'http' }] };
    expect(derived([http('exact')], graph)).toEqual([]);
    const other = { ...http('exact'), id: 'h2' };
    expect(derived([http('exact'), other], pair('/a', '/a'))).toHaveLength(1);
  });

  it('caps the edges of one rule', () => {
    const rule = spec({
      id: 'cap',
      derived: [
        {
          id: 'c',
          kind: 'k',
          from: { kind: 'f' },
          to: { kind: 't' },
          join: { from: 'props.v', to: 'props.v' },
        },
      ],
    });
    const big: DecoratedGraph = {
      nodes: Array.from({ length: 300 }, (_, i) => ({
        key: `n${i}`,
        kind: i < 150 ? 'f' : 't',
        props: { v: 1 },
      })),
      edges: [],
    };
    expect(derived([rule], big)).toHaveLength(MAX_DERIVED_PER_RULE);
  });
});

describe('schema strictness', () => {
  const c = (extra: object) => ({ id: 'r', check: 'node', message: 'm', match: {}, ...extra });
  it('rejects unknown keys, bad severity, missing message', () => {
    expect(() => constraintSchema.parse(c({ nope: 1 }))).toThrow();
    expect(() => constraintSchema.parse(c({ severity: 'fatal' }))).toThrow();
    expect(() => constraintSchema.parse(c({ message: undefined }))).toThrow();
    expect(() => spec({ id: 'x', extra: 1 } as never)).toThrow();
  });
  it('rejects both tag and tagFrom', () => {
    expect(() =>
      spec({
        id: 'x',
        concepts: [{ id: 'c', tag: 't', tagFrom: { field: 'file', pattern: 'a' } }],
      }),
    ).toThrow();
  });
});

describe('matchProp and selectors', () => {
  it('handles exists, ne, regex and scalars', () => {
    expect(matchProp(1, { exists: true })).toBe(true);
    expect(matchProp(undefined, { exists: true })).toBe(false);
    expect(matchProp(null, { exists: false })).toBe(true);
    expect(matchProp('a', { ne: 'b' })).toBe(true);
    expect(matchProp('a', { ne: 'a' })).toBe(false);
    expect(matchProp('abc', { regex: '^ab' })).toBe(true);
    expect(matchProp(5, { regex: '5' })).toBe(false);
    expect(matchProp('x', 'x')).toBe(true);
    expect(matchProp(3, 4)).toBe(false);
    expect(matchProp(undefined, { gt: 1 })).toBe(false);
  });

  it('handles all and external', () => {
    const n = { key: 'a', kind: 'K', external: true };
    expect(matchSelector(n, new Set(), { all: [{ kind: 'K' }, { external: true }] })).toBe(true);
    expect(matchSelector(n, new Set(), { all: [{ kind: 'K' }, { external: false }] })).toBe(false);
    expect(matchSelector({ key: 'b' }, new Set(), { external: false })).toBe(true);
    expect(matchSelector(n, new Set(), { external: false })).toBe(false);
  });
});

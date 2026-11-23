import { describe, expect, it } from 'vitest';
import type { DecoratedGraph, Decoration } from './graph';
import { evaluateDecorators } from './evaluate';
import { layersDecorator, noCyclesDecorator } from './presets';
import { decoratorSpecSchema, type DecoratorSpecInput } from './schema';
import { globToRegex, matchSelector } from './selector';
import { normalizeUrl } from './derive';

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
    expect(ruleIds(node(decorations, 'Audit'))).toEqual(['layer-infra-upward']);
    expect(ruleIds(node(decorations, 'UserRepo'))).toEqual(['layer-infra-upward']);
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

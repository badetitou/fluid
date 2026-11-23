import { describe, expect, it } from 'vitest';
import { decoratorToCypher } from './cypher';
import { evaluateDecorators } from './evaluate';
import type { DecoratedGraph } from './graph';
import { renderDecoratorDocs } from './docs';
import { sarifLogSchema } from './sarif';
import { decoratorSpecSchema } from './schema';

const graph: DecoratedGraph = {
  nodes: [
    {
      key: 'big',
      kind: 'CLASS',
      name: 'Big',
      file: 'src/A.java',
      props: { startLine: 1, endLine: 50 },
    },
    {
      key: 'other',
      kind: 'CLASS',
      name: 'Other',
      file: 'src/B.java',
      props: { startLine: 1, endLine: 5 },
    },
  ],
  edges: [],
};
const log = sarifLogSchema.parse({
  runs: [
    {
      tool: { driver: { name: 'example-linter' } },
      results: [
        {
          ruleId: 'unused-import',
          level: 'error',
          message: { text: 'Unused import' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: '/repo/src/A.java' },
                region: { startLine: 3 },
              },
            },
          ],
        },
        {
          ruleId: 'unused-import',
          message: { text: 'Elsewhere' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: '/repo/src/Z.java' },
                region: { startLine: 1 },
              },
            },
          ],
        },
      ],
    },
  ],
});
const spec = decoratorSpecSchema.parse({
  id: 'quality',
  label: 'Quality',
  imports: [{ id: 'lint', format: 'sarif', url: 'lint.sarif.json', stripPrefix: '/repo/' }],
  constraints: [{ id: 'is-big', check: 'node', message: 'Big', match: { name: '^Big$' } }],
});

describe('decorator imports', () => {
  it('validate: the format is sarif, the URL is required, imports default to none', () => {
    expect(decoratorSpecSchema.parse({ id: 'x', label: 'x' }).imports).toEqual([]);
    const bad = (imp: unknown) =>
      decoratorSpecSchema.safeParse({ id: 'x', label: 'x', imports: [imp] }).success;
    expect(bad({ id: 'a', format: 'csv', url: 'u' })).toBe(false);
    expect(bad({ id: 'a', format: 'sarif', url: '' })).toBe(false);
    expect(bad({ id: 'a', format: 'sarif', url: 'u', extra: 1 })).toBe(false);
    const dup = {
      id: 'x',
      label: 'x',
      imports: [1, 2].map(() => ({ id: 'a', format: 'sarif', url: 'u' })),
    };
    expect(decoratorSpecSchema.safeParse(dup).success).toBe(false);
    expect(
      bad({
        id: 'a',
        format: 'sarif',
        url: 'u',
        stripPrefix: ['/a'],
        addPrefix: 'p',
        kinds: ['CLASS'],
      }),
    ).toBe(true);
  });

  it('give findings next to the rule findings, and count the unmatched ones', () => {
    const result = evaluateDecorators([spec], graph, {
      imported: new Map([['quality/lint', log]]),
    });
    const big = result.decorations.find((d) => d.target.key === 'big');
    expect(big?.findings.map((f) => f.ruleId).sort()).toEqual(['is-big', 'unused-import']);
    const imported = big?.findings.find((f) => f.ruleId === 'unused-import');
    expect(imported).toMatchObject({
      decoratorId: 'quality',
      severity: 'error',
      message: 'L3: Unused import',
    });
    expect(result.unmatched).toEqual({ 'quality/lint': 1 });
  });

  it('are ignored without their log', () => {
    for (const options of [
      undefined,
      { imported: new Map() },
      { imported: new Map([['quality/other', log]]) },
    ]) {
      const result = evaluateDecorators([spec], graph, options);
      expect(result.decorations.flatMap((d) => d.findings.map((f) => f.ruleId))).toEqual([
        'is-big',
      ]);
      expect(result.unmatched).toBeUndefined();
    }
  });

  it('have no Cypher form, and are listed in the docs', () => {
    expect(decoratorToCypher(spec)).toHaveLength(1);
    expect(renderDecoratorDocs([spec])).toContain('import lint (sarif)');
  });
});

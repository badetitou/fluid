import { describe, expect, it } from 'vitest';
import type { DecoratedNode } from './graph';
import { normalizeArtifactPath, sarifLogSchema, sarifToFindings } from './sarif';

const range = (startLine: number, endLine: number) => ({ range: { startLine, endLine } });
const nodes: DecoratedNode[] = [
  { key: 'f', kind: 'FILE', file: 'src/A.java' },
  { key: 'cls', kind: 'CLASS', file: 'src/A.java', props: range(1, 50) },
  { key: 'm', kind: 'METHOD', file: 'src/A.java', props: range(10, 20) },
  { key: 'g', kind: 'FILE', file: 'src/B.java' },
  { key: 'flat', kind: 'METHOD', file: 'src/C.java', props: { startLine: 3, endLine: 4 } },
];

function log(results: unknown[], extra: Record<string, unknown> = {}) {
  return sarifLogSchema.parse({
    runs: [{ tool: { driver: { name: 'example-linter', ...extra } }, results }],
  });
}
const res = (uri: string, line: number, more: Record<string, unknown> = {}) => ({
  ruleId: 'java:S1128',
  level: 'error',
  message: { text: 'Unused import' },
  locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } }],
  ...more,
});
const opts = { decoratorId: 'lint' };

describe('normalizeArtifactPath', () => {
  it('handles file://, ./, encoding and prefixes', () => {
    expect(normalizeArtifactPath('./src/A.java')).toBe('src/A.java');
    expect(normalizeArtifactPath('file:///repo/src/My%20A.java', { stripPrefix: '/repo/' })).toBe(
      'src/My A.java',
    );
    expect(normalizeArtifactPath('a\\b.java', { addPrefix: 'x' })).toBe('x/a/b.java');
    expect(normalizeArtifactPath('/r1/a.java', { stripPrefix: ['/r0', '/r1'] })).toBe('a.java');
  });
});

describe('sarifToFindings', () => {
  it('matches relative, file:// and prefixed paths', () => {
    const r = sarifToFindings(
      log([res('src/A.java', 15), res('file:///w/src/B.java', 1), res('lib/src/C.java', 3)]),
      nodes,
      { ...opts, stripPrefix: ['/w/', 'lib/'] },
    );
    expect(r.findings.map((f) => f.key)).toEqual(['m', 'g', 'flat']);
  });

  it('adds a prefix to match the graph', () => {
    const r = sarifToFindings(log([res('A.java', 15)]), nodes, { ...opts, addPrefix: 'src' });
    expect(r.findings.map((f) => f.key)).toEqual(['m']);
  });

  it('picks the innermost node and falls back to the FILE node', () => {
    const r = sarifToFindings(
      log([res('src/A.java', 15), res('src/A.java', 30), res('src/A.java', 99)]),
      nodes,
      opts,
    );
    expect(r.findings.map((f) => f.key)).toEqual(['m', 'cls', 'f']);
    expect(r.findings[0].finding.message).toBe('L15: Unused import');
    expect(r.findings[0].finding.decoratorId).toBe('lint');
  });

  it('counts unmatched results and unknown files', () => {
    const r = sarifToFindings(log([res('src/C.java', 99), res('nope.java', 1)]), nodes, opts);
    expect(r.findings).toEqual([]);
    expect(r.unmatched).toBe(2);
  });

  it('restricts to kinds', () => {
    const r = sarifToFindings(log([res('src/A.java', 15)]), nodes, { ...opts, kinds: ['CLASS'] });
    expect(r.findings.map((f) => f.key)).toEqual(['cls']);
  });

  it('maps levels with rule defaults', () => {
    const rules = [
      { id: 'r0', defaultConfiguration: { level: 'note' }, shortDescription: { text: 'Short' } },
    ];
    const bare = { ruleId: undefined, level: undefined, message: undefined };
    const r = sarifToFindings(
      log(
        [
          res('src/A.java', 15, { level: 'warning' }),
          res('src/A.java', 15, { level: 'none' }),
          res('src/A.java', 15, { ...bare, ruleIndex: 0 }),
          res('src/A.java', 15, { ...bare, ruleId: 'x' }),
        ],
        { rules },
      ),
      nodes,
      opts,
    );
    expect(r.findings.map((f) => f.finding.severity)).toEqual([
      'warning',
      'info',
      'info',
      'warning',
    ]);
    expect(r.findings[2].finding.ruleId).toBe('r0');
    expect(r.findings[2].finding.message).toBe('L15: Short');
  });

  it('cuts stripPrefix on a path-segment boundary, with or without a trailing slash', () => {
    expect(normalizeArtifactPath('/repository/a.java', { stripPrefix: '/repo' })).toBe('/repository/a.java');
    expect(normalizeArtifactPath('/repo/a.java', { stripPrefix: '/repo' })).toBe('a.java');
    expect(normalizeArtifactPath('/repo/a.java', { stripPrefix: '/repo/' })).toBe('a.java');
  });

  it('handles a malformed %-escape and a Windows file URI', () => {
    expect(normalizeArtifactPath('src/100%.java')).toBe('src/100%.java');
    expect(normalizeArtifactPath('file:///C:/repo/src/A.java', { stripPrefix: 'C:/repo' })).toBe('src/A.java');
  });

  it('attaches a result without region to the FILE node, and counts one without location as unmatched', () => {
    const noRegion = {
      ruleId: 'r',
      message: { text: 'File level' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/A.java' } } }],
    };
    const r = sarifToFindings(log([noRegion, { ruleId: 'r', message: { text: 'Nowhere' } }]), nodes, opts);
    expect(r.findings.map((f) => f.key)).toEqual(['f']);
    expect(r.findings[0].finding.message).toBe('File level');
    expect(r.unmatched).toBe(1);
  });

  it('falls back to the rule default for an unknown level, and lets a result level override it', () => {
    const rules = [{ id: 'r0', defaultConfiguration: { level: 'error' } }];
    const r = sarifToFindings(
      log([res('src/A.java', 15, { level: 'weird', ruleIndex: 0 }), res('src/A.java', 15, { level: 'note', ruleIndex: 0 })], { rules }),
      nodes,
      opts,
    );
    expect(r.findings.map((f) => f.finding.severity)).toEqual(['error', 'info']);
  });

  it('reads several runs', () => {
    const one = { tool: { driver: { name: 'a' } }, results: [res('src/A.java', 15)] };
    const l = sarifLogSchema.parse({ runs: [one, one] });
    expect(sarifToFindings(l, nodes, opts).findings).toHaveLength(2);
  });

  it('rejects an invalid log', () => {
    expect(sarifLogSchema.safeParse({ runs: 3 }).success).toBe(false);
    expect(sarifLogSchema.safeParse({}).success).toBe(false);
  });

  it('stays fast on 10k nodes and results', () => {
    const many: DecoratedNode[] = Array.from({ length: 10000 }, (_, i) => ({
      key: `n${i}`,
      kind: 'METHOD',
      file: `f${i % 100}.java`,
      props: range(i, i + 1),
    }));
    const l = log(Array.from({ length: 10000 }, (_, i) => res(`f${i % 100}.java`, i)));
    const t = Date.now();
    expect(sarifToFindings(l, many, opts).findings).toHaveLength(10000);
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

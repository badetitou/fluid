import { describe, expect, it } from 'vitest';
import type { AnalyzeViewRequest } from '@fluid/shared';
import { analyzeView, parseInsight } from './insight';
import { mockInsight } from './insightMock';
import { buildInsightMessages } from './insightPrompt';

const characters = Array.from({ length: 10 }, (_, i) => ({
  name: `C${i}`,
  species: i < 8 ? 'Human' : 'Alien',
  status: i < 3 ? 'unknown' : 'Alive',
}));
const request: AnalyzeViewRequest = {
  view: { title: 'Characters', concept: 'Character' },
  focus: 'Who survives?',
  sources: [{ id: 'roster', type: 'table', title: 'Characters', rowCount: 10, data: characters }],
};

describe('parseInsight', () => {
  it('reads a fenced JSON answer', () => {
    const answer =
      '```json\n{"verdict":"insights","findings":[{"kind":"gap","severity":"notable","title":"t","detail":"d"}]}\n```';
    const parsed = parseInsight(answer);
    expect(parsed.ok && parsed.analysis.findings[0].title).toBe('t');
  });

  it('turns insights without a finding into nothing', () => {
    const parsed = parseInsight('{"verdict":"insights","findings":[]}');
    expect(parsed.ok && parsed.analysis.verdict).toBe('nothing');
  });

  it('falls back to info for an unknown severity', () => {
    const parsed = parseInsight('{"verdict":"insights","findings":[{"kind":"k","severity":"huge","title":"t","detail":"d"}]}');
    expect(parsed.ok && parsed.analysis.findings[0].severity).toBe('info');
  });

  it('rejects what is not an analysis', () => {
    expect(parseInsight('no JSON here').ok).toBe(false);
    expect(parseInsight('{"verdict":"maybe"}').ok).toBe(false);
  });
});

describe('mockInsight', () => {
  it('flags a mostly missing field and a dominant value', () => {
    const analysis = mockInsight(request);
    expect(analysis.verdict).toBe('insights');
    expect(analysis.findings.map((f) => f.kind)).toEqual(['concentration', 'gap']);
    expect(analysis.findings[1].title).toContain('"status" is missing for 30%');
  });

  it('has nothing to say about a handful of rows', () => {
    expect(mockInsight({ ...request, sources: [{ ...request.sources[0], data: characters.slice(0, 3) }] }).verdict).toBe(
      'nothing',
    );
  });
});

describe('analyzeView', () => {
  it('answers offline with the mock provider', async () => {
    const result = await analyzeView({ ...request, config: { provider: 'mock' } });
    expect(result.provider).toBe('mock');
    expect(result.analysis.findings.length).toBeGreaterThan(0);
  });
});

describe('buildInsightMessages', () => {
  it('gives the focus and each widget with its data', () => {
    const [system, user] = buildInsightMessages(request);
    expect(system.content).toContain('"verdict": "insights" | "nothing"');
    expect(user.content).toContain("The user's focus: Who survives?");
    expect(user.content).toContain('Widget "roster", type table, title "Characters" (10 rows in total)');
  });
});

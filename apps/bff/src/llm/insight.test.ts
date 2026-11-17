import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyzeViewRequest, InsightAnalysis } from '@fluid/shared';
import { LlmValidationError } from './errors';
import { analyzeView, INSIGHT_TIMEOUT_MS, parseInsight } from './insight';
import { mockInsight } from './insightMock';
import { buildInsightMessages } from './insightPrompt';

// The providers are stubbed: these tests cover the dispatch, the parsing and the repair turn.
const chatCompletion = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());
const claudeCodeCompletion = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());
vi.mock('./client', async (original) => ({ ...(await original<object>()), chatCompletion }));
vi.mock('./claudeCode', () => ({ claudeCodeCompletion }));

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
const finding = { kind: 'gap', severity: 'notable', title: 't', detail: 'd', evidence: ['3 of 10'], widgets: ['roster'] };
const valid: InsightAnalysis = { verdict: 'insights', headline: 'h', findings: [finding] as InsightAnalysis['findings'], questions: ['q?'] };

beforeEach(() => {
  chatCompletion.mockReset();
  claudeCodeCompletion.mockReset();
});

describe('parseInsight', () => {
  it('reads a fenced JSON answer, questions included', () => {
    expect(parseInsight('```json\n' + JSON.stringify(valid) + '\n```')).toEqual({ ok: true, analysis: valid });
  });

  it('decides the verdict from the findings', () => {
    expect(parseInsight('{"verdict":"insights","findings":[]}')).toEqual({
      ok: true,
      analysis: { verdict: 'nothing', findings: [] },
    });
    expect(parseInsight(JSON.stringify({ ...valid, verdict: 'nothing' }))).toEqual({ ok: true, analysis: valid });
  });

  it('falls back to info for an unknown severity', () => {
    const parsed = parseInsight(JSON.stringify({ verdict: 'insights', findings: [{ ...finding, severity: 'huge' }] }));
    expect(parsed).toEqual({ ok: true, analysis: { verdict: 'insights', findings: [{ ...finding, severity: 'info' }] } });
  });

  it('rejects what is not an analysis', () => {
    expect(parseInsight('no JSON here').ok).toBe(false);
    expect(parseInsight('{"verdict":"maybe"}').ok).toBe(false);
  });
});

describe('mockInsight', () => {
  it('flags a dominant value and a mostly missing field', () => {
    expect(mockInsight(request)).toEqual({
      verdict: 'insights',
      headline: 'A first look by the offline analyst (mock provider): pick a real model for an in-depth analysis.',
      findings: [
        {
          kind: 'concentration',
          severity: 'info',
          title: '"Human" dominates "species" (80%)',
          detail: 'The 1 other values share what is left: comparisons between them rest on few rows.',
          evidence: ['8 of 10 rows'],
          widgets: ['roster'],
        },
        {
          kind: 'gap',
          severity: 'notable',
          title: '"status" is missing for 30% of the rows',
          detail: 'Figures grouped by this field leave a large share of the data out, or lump it under "unknown".',
          evidence: ['3 of 10 rows'],
          widgets: ['roster'],
        },
      ],
    });
  });

  it('has nothing to say about a handful of rows', () => {
    const few = { ...request, sources: [{ ...request.sources[0], data: characters.slice(0, 3) }] };
    expect(mockInsight(few)).toEqual({ verdict: 'nothing', findings: [] });
  });
});

describe('analyzeView', () => {
  it('answers offline with the mock provider, without calling a model', async () => {
    const result = await analyzeView({ ...request, config: { provider: 'mock' } });
    expect(result).toEqual({ analysis: mockInsight(request), provider: 'mock', model: 'mock' });
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('asks an OpenAI-compatible server, with a timeout', async () => {
    chatCompletion.mockResolvedValue(JSON.stringify(valid));
    const result = await analyzeView({ ...request, config: { provider: 'ollama' } });
    expect(result.analysis).toEqual(valid);
    expect(chatCompletion).toHaveBeenCalledWith(expect.anything(), expect.any(Array), { timeoutMs: INSIGHT_TIMEOUT_MS });
  });

  it('asks Claude Code when it is the provider', async () => {
    claudeCodeCompletion.mockResolvedValue(JSON.stringify(valid));
    const result = await analyzeView({ ...request, config: { provider: 'claude-code' } });
    expect(result).toMatchObject({ analysis: valid, provider: 'claude-code' });
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('repairs an invalid answer once', async () => {
    chatCompletion.mockResolvedValueOnce('oops').mockResolvedValueOnce(JSON.stringify(valid));
    const result = await analyzeView({ ...request, config: { provider: 'ollama' } });
    expect(result.analysis).toEqual(valid);
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    const repair = chatCompletion.mock.calls[1][1] as { role: string; content: string }[];
    expect(repair.at(-2)).toEqual({ role: 'assistant', content: 'oops' });
    expect(repair.at(-1)?.content).toContain('not a valid analysis object');
  });

  it('fails after two invalid answers', async () => {
    chatCompletion.mockResolvedValue('{"verdict":"maybe"}');
    await expect(analyzeView({ ...request, config: { provider: 'ollama' } })).rejects.toBeInstanceOf(LlmValidationError);
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });
});

describe('buildInsightMessages', () => {
  it('gives the focus and each widget with its data', () => {
    const [system, user] = buildInsightMessages(request);
    expect(system.content).toContain('"verdict": "insights" | "nothing"');
    expect(user.content).toContain("The user's focus: Who survives?");
    expect(user.content).toContain('Widget "roster", type table, title "Characters" (10 rows in total)');
    expect(user.content).toContain(JSON.stringify(characters));
  });
});

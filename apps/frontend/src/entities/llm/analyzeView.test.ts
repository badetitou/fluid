import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalyzeViewRequest } from '@fluid/shared';
import { analyzeView } from './analyzeView';

const request: AnalyzeViewRequest = { view: { title: 'T', concept: 'C' }, sources: [] };
const answer = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe('analyzeView', () => {
  it('posts the request with the LLM settings and returns the validated analysis', async () => {
    const fetch = answer(200, { analysis: { verdict: 'nothing', findings: [] }, provider: 'mock', model: 'mock' });
    expect(await analyzeView(request, { provider: 'mock' })).toEqual({ verdict: 'nothing', findings: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/llm\/analyze-view$/);
    expect(JSON.parse(String(init?.body))).toEqual({ ...request, config: { provider: 'mock' } });
  });

  it('throws the error the BFF gives', async () => {
    answer(422, { error: 'The model did not answer with a valid analysis', details: 'x' });
    await expect(analyzeView(request, {})).rejects.toThrow('The model did not answer with a valid analysis');
  });

  it('throws a short message on an answer that is not an analysis', async () => {
    answer(200, { analysis: { verdict: 'maybe' } });
    await expect(analyzeView(request, {})).rejects.toThrow('The analysis received from the BFF is not valid');
  });

  it('throws a short message on an error that is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 503 }));
    await expect(analyzeView(request, {})).rejects.toThrow('The BFF answered 503');
  });
});

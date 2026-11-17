import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmError, LlmValidationError } from '../llm/errors';

// The analysis itself is stubbed: these tests cover what the route answers.
// A plain function, not a vi.fn: vitest reports an error thrown by a mock as a test failure,
// even when the route catches it.
const stub = vi.hoisted(() => ({ calls: [] as unknown[], answer: (): Promise<unknown> => Promise.resolve(undefined) }));
vi.mock('../llm/insight', () => ({
  analyzeView: (input: unknown) => {
    stub.calls.push(input);
    return stub.answer();
  },
}));

const body = {
  view: { title: 'Characters', concept: 'Character' },
  sources: [{ id: 'roster', type: 'table', data: [{ name: 'Rick' }] }],
  config: { provider: 'mock' },
};
const post = (app: FastifyInstance, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/llm/analyze-view', payload: payload as object });

describe('POST /api/llm/analyze-view', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    const { llmRoutes } = await import('./llm');
    app = Fastify({ logger: false });
    await app.register(llmRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    stub.calls = [];
  });

  it('answers the analysis', async () => {
    const result = { analysis: { verdict: 'nothing', findings: [] }, provider: 'mock', model: 'mock' };
    stub.answer = async () => result;
    const res = await post(app, body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(result);
    expect(stub.calls).toEqual([body]);
  });

  it('rejects a body without sources, an unknown provider or too much data with 400', async () => {
    const { sources: _, ...noSources } = body;
    const huge = { ...body, sources: [{ id: 'big', type: 'table', data: 'x'.repeat(200_001) }] };
    for (const bad of [noSources, { ...body, config: { provider: 'gpt' } }, huge]) {
      const res = await post(app, bad);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'Invalid body' });
    }
    expect(stub.calls).toEqual([]);
  });

  it('answers 422 when the model never gives a valid analysis', async () => {
    stub.answer = async () => {
      throw new LlmValidationError('verdict: invalid', 'raw');
    };
    const res = await post(app, body);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'The model did not answer with a valid analysis', details: 'verdict: invalid' });
  });

  it('answers 502 when the provider fails', async () => {
    stub.answer = async () => {
      throw new LlmError('LLM returned HTTP 500');
    };
    const res = await post(app, body);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: 'LLM returned HTTP 500' });
  });
});

import { describe, expect, it } from 'vitest';
import { extractJson, extractReasoning } from './json';

describe('extractJson', () => {
  it('parses raw JSON, fenced JSON and prose around an object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n{"a":1}\nDone.')).toEqual({ a: 1 });
  });

  it('rejects text without a JSON object', () => {
    expect(() => extractJson('no json here')).toThrow('not valid JSON');
  });
});

describe('extractReasoning', () => {
  it('splits a THINKING: block from the JSON payload', () => {
    const result = extractReasoning('THINKING:\n- first step\n- second step\n{"a":1}');
    expect(result.reasoning).toEqual(['first step', 'second step']);
    expect(result.content).toBe('{"a":1}');
  });

  it('leaves a plain answer untouched', () => {
    expect(extractReasoning('{"a":1}')).toEqual({ reasoning: [], content: '{"a":1}' });
  });
});

import { describe, expect, it } from 'vitest';
import type { LlmConfig } from './types';
import { hostnameOf, isJsonModeRejection, supportsJsonMode } from './modelCapabilities';

const config = (baseUrl: string): LlmConfig => ({
  provider: 'openai',
  model: 'test',
  baseUrl,
});

describe('model capabilities', () => {
  it('reads the hostname of a base URL', () => {
    expect(hostnameOf('https://api.groq.com/openai/v1')).toBe('api.groq.com');
    expect(hostnameOf('not a url')).toBe('');
  });

  it('disables JSON mode for known free-tier endpoints', () => {
    expect(supportsJsonMode(config('https://generativelanguage.googleapis.com/v1beta/openai'))).toBe(false);
    expect(supportsJsonMode(config('https://api.groq.com/openai/v1/'))).toBe(false);
    expect(supportsJsonMode(config('https://openrouter.ai/api/v1'))).toBe(false);
  });

  it('keeps JSON mode for OpenAI, local endpoints and unknown compatible APIs', () => {
    expect(supportsJsonMode(config('https://api.openai.com/v1'))).toBe(true);
    expect(supportsJsonMode(config('http://localhost:11434/v1'))).toBe(true);
    expect(supportsJsonMode({ ...config('https://llm.example.com/v1'), provider: 'ollama' })).toBe(true);
  });

  it('recognises a JSON-mode rejection but not other bad requests', () => {
    expect(isJsonModeRejection(400, 'Invalid response_format: json_object is not supported')).toBe(true);
    expect(isJsonModeRejection(422, 'structured output is unavailable for this model')).toBe(true);
    expect(isJsonModeRejection(400, 'unknown model')).toBe(false);
    expect(isJsonModeRejection(429, 'response_format rate limited')).toBe(false);
  });
});

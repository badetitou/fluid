import { describe, expect, it } from 'vitest';
import { parseLlmCapabilities } from './llmCapabilities';

const valid = {
  defaultProvider: 'openai',
  providers: {
    openai: { configured: true, model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434/v1' },
    mock: { available: true },
  },
};

describe('parseLlmCapabilities', () => {
  it('accepts the BFF payload, with or without Claude Code', () => {
    expect(parseLlmCapabilities(valid).defaultProvider).toBe('openai');
    expect(
      parseLlmCapabilities({
        ...valid,
        providers: {
          ...valid.providers,
          'claude-code': { available: true, version: '2.0.0', model: 'sonnet' },
        },
      }).providers['claude-code']?.version,
    ).toBe('2.0.0');
  });

  it('rejects a malformed payload instead of letting it reach the settings UI', () => {
    expect(() => parseLlmCapabilities({ ...valid, defaultProvider: 'unknown' })).toThrow();
    expect(() => parseLlmCapabilities({ defaultProvider: 'mock' })).toThrow();
  });
});

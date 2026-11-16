import { describe, expect, it } from 'vitest';
import { effectiveProvider } from './effectiveProvider';

describe('effectiveProvider', () => {
  it('uses the server default until the user picks a provider', () => {
    expect(effectiveProvider({ provider: 'mock', providerChosen: false }, 'claude-code')).toBe('claude-code');
  });
  it('keeps the provider the user picked over the server default', () => {
    expect(effectiveProvider({ provider: 'ollama', providerChosen: true }, 'openai')).toBe('ollama');
  });
  it('keeps an explicitly chosen mock', () => {
    expect(effectiveProvider({ provider: 'mock', providerChosen: true }, 'openai')).toBe('mock');
  });
  it('falls back to the stored provider when the server is unreachable', () => {
    expect(effectiveProvider({ provider: 'mock', providerChosen: false }, null)).toBe('mock');
    expect(effectiveProvider({ provider: 'mock', providerChosen: false }, undefined)).toBe('mock');
  });
});

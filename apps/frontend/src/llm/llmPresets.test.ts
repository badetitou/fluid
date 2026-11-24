import { describe, expect, it } from 'vitest';
import { detectPreset, findPreset, LLM_PRESETS, presetPatch } from './llmPresets';

describe('LLM presets', () => {
  it('has unique ids and only known providers', () => {
    const ids = LLM_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of LLM_PRESETS) {
      expect(['openai', 'ollama', 'claude-code', 'mock', 'browser']).toContain(preset.provider);
    }
  });

  it('keeps the key when reapplying the same preset', () => {
    const preset = findPreset('groq-free')!;
    expect(
      presetPatch(preset, { provider: 'openai', apiKey: 'gsk-secret', presetId: 'groq-free' }).apiKey,
    ).toBe('gsk-secret');
  });

  it('drops the key when switching preset, even to another OpenAI-compatible API', () => {
    const preset = findPreset('gemini-free')!;
    expect(
      presetPatch(preset, { provider: 'openai', apiKey: 'sk-openai', presetId: 'openai' }).apiKey,
    ).toBe('');
  });

  it('drops the key for local and subscription providers', () => {
    for (const id of ['browser-webgpu', 'ollama-local', 'lm-studio', 'claude-code', 'mock'] as const) {
      const preset = findPreset(id)!;
      expect(
        presetPatch(preset, { provider: preset.provider, apiKey: 'secret', presetId: id }).apiKey,
      ).toBe('');
    }
  });

  it('detects a preset from a draft and reports custom models as none', () => {
    const preset = findPreset('ollama-local')!;
    expect(detectPreset({ provider: preset.provider, model: preset.model, baseUrl: preset.baseUrl })).toBe(
      'ollama-local',
    );
    expect(detectPreset({ provider: 'ollama', model: 'custom', baseUrl: preset.baseUrl })).toBeNull();
  });

  it('returns no preset for an unknown id', () => {
    expect(findPreset('not-a-preset')).toBeUndefined();
  });
});

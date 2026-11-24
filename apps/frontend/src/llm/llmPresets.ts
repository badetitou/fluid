import type { LlmProvider } from '../store';

export type LlmPresetId =
  | 'mock'
  | 'claude-code'
  | 'browser-webgpu'
  | 'ollama-local'
  | 'lm-studio'
  | 'openai'
  | 'gemini-free'
  | 'groq-free'
  | 'openrouter-free';

export interface LlmPreset {
  id: LlmPresetId;
  label: string;
  provider: LlmProvider;
  /** Empty means "use the BFF default" (useful with a server-side key). */
  model: string;
  /** Empty means "use the BFF default". */
  baseUrl: string;
  requiresKey: boolean;
  keyPlaceholder: string;
  keyHelpLabel?: string;
  keyHelpUrl?: string;
  /** Privacy / quota note shown in the settings form. */
  note?: string;
  noteTone?: 'info' | 'warning';
  /** Hint for the BFF's JSON response mode (only used when the endpoint supports it). */
  jsonMode: boolean;
}

/**
 * Quick setups for the OpenAI-compatible client. Free hosted tiers are real but
 * rate-limited; local endpoints need no key and never send data off the machine
 * hosting the BFF. Models and quotas change often — the notes are deliberately
 * short and the URLs point to the provider's console.
 */
export const LLM_PRESETS: readonly LlmPreset[] = [
  {
    id: 'mock',
    label: 'Mock — offline, no key',
    provider: 'mock',
    model: 'mock',
    baseUrl: '',
    requiresKey: false,
    keyPlaceholder: '',
    jsonMode: true,
  },
  {
    id: 'claude-code',
    label: 'Claude — local Claude Code login',
    provider: 'claude-code',
    model: 'sonnet',
    baseUrl: '',
    requiresKey: false,
    keyPlaceholder: '',
    jsonMode: true,
  },
  {
    id: 'browser-webgpu',
    label: 'Browser WebGPU — no server, no key',
    provider: 'browser',
    model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    baseUrl: '',
    requiresKey: false,
    keyPlaceholder: '',
    note: 'Runs in this browser tab with WebGPU: nothing is sent to a server. Needs Chrome/Edge with WebGPU, HTTPS, and a ~900 MB model downloaded on first use.',
    noteTone: 'info',
    jsonMode: true,
  },
  {
    id: 'ollama-local',
    label: 'Ollama — local model',
    provider: 'ollama',
    model: 'llama3.1',
    baseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
    keyPlaceholder: '',
    note: 'Runs on the machine hosting the BFF. Install Ollama then run `ollama pull llama3.1`. No key, no data sent to a provider.',
    noteTone: 'info',
    jsonMode: true,
  },
  {
    id: 'lm-studio',
    label: 'LM Studio / llama.cpp — local model',
    provider: 'openai',
    model: 'local-model',
    baseUrl: 'http://localhost:1234/v1',
    requiresKey: false,
    keyPlaceholder: '',
    note: 'Any local server exposing /v1/chat/completions works. It must be reachable from the BFF, not just from your browser.',
    noteTone: 'info',
    jsonMode: true,
  },
  {
    id: 'openai',
    label: 'OpenAI (or compatible API)',
    provider: 'openai',
    model: '',
    baseUrl: '',
    requiresKey: true,
    keyPlaceholder: 'sk-…',
    jsonMode: true,
  },
  {
    id: 'gemini-free',
    label: 'Gemini — free tier',
    provider: 'openai',
    model: 'gemini-3.8-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    requiresKey: true,
    keyPlaceholder: 'AI Studio API key',
    keyHelpLabel: 'Google AI Studio',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    note: 'Free tier limits are set per project and change often. Outside the EEA/UK/CH, Google may use submitted content to improve its products.',
    noteTone: 'warning',
    jsonMode: false,
  },
  {
    id: 'groq-free',
    label: 'Groq — free tier',
    provider: 'openai',
    model: 'openai/gpt-oss-120b',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    keyPlaceholder: 'Groq API key',
    keyHelpLabel: 'Groq Console',
    keyHelpUrl: 'https://console.groq.com/keys',
    note: 'Free tier: about 30 requests/min, 1,000/day and 200k tokens/day per model. Enough for demos, not for batch work.',
    noteTone: 'warning',
    jsonMode: false,
  },
  {
    id: 'openrouter-free',
    label: 'OpenRouter — free models',
    provider: 'openai',
    model: 'google/gemma-4-31b-it:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    keyPlaceholder: 'OpenRouter API key',
    keyHelpLabel: 'OpenRouter',
    keyHelpUrl: 'https://openrouter.ai/keys',
    note: 'Models ending in :free cost nothing: 20 requests/min, 50/day (1,000/day after 10 credits). The catalogue rotates — pick a current one at openrouter.ai/models.',
    noteTone: 'warning',
    jsonMode: false,
  },
];

export function findPreset(id: LlmPresetId | string | null | undefined): LlmPreset | undefined {
  return LLM_PRESETS.find((preset) => preset.id === id);
}

/** Which preset, if any, produced this draft — so edits show as "Custom". */
export function detectPreset(draft: {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
}): LlmPresetId | null {
  return (
    LLM_PRESETS.find(
      (preset) =>
        preset.provider === draft.provider &&
        preset.model === draft.model &&
        preset.baseUrl === draft.baseUrl,
    )?.id ?? null
  );
}

/** Apply a preset to a settings draft, dropping keys that belong to another setup. */
export function presetPatch(
  preset: LlmPreset,
  current: { provider: LlmProvider; apiKey: string; presetId: LlmPresetId | string | null },
) {
  const keepKey = preset.requiresKey && current.presetId === preset.id;
  return {
    provider: preset.provider,
    model: preset.model,
    baseUrl: preset.baseUrl,
    apiKey: keepKey ? current.apiKey : '',
  };
}

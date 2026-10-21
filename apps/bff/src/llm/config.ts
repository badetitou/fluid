import type { LlmConfig, LlmConfigOverrides, LlmProvider } from './types';
import { detectClaudeCode } from './claudeCode';

const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const OLLAMA_DEFAULT_MODEL = 'llama3.1';
const CLAUDE_CODE_DEFAULT_BIN = 'claude';
const CLAUDE_CODE_DEFAULT_MODEL = 'sonnet';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

function openaiConfigured(): boolean {
  return Boolean(env('OPENAI_API_KEY'));
}

/** Determine the effective provider from overrides → env → sensible default. */
function pickProvider(override?: LlmProvider): LlmProvider {
  if (override) return override;
  const fromEnv = env('LLM_PROVIDER') as LlmProvider | undefined;
  if (fromEnv === 'openai' || fromEnv === 'ollama' || fromEnv === 'claude-code' || fromEnv === 'mock') {
    return fromEnv;
  }
  // Fall back to OpenAI when a key is present, otherwise the offline mock.
  return openaiConfigured() ? 'openai' : 'mock';
}

/**
 * Merge per-request overrides with environment configuration into a concrete
 * provider config. Secrets only ever come from env or the request — never
 * persisted.
 */
export function resolveLlmConfig(overrides: LlmConfigOverrides = {}): LlmConfig {
  const provider = pickProvider(overrides.provider);

  if (provider === 'openai') {
    return {
      provider,
      model: overrides.model ?? env('OPENAI_MODEL') ?? OPENAI_DEFAULT_MODEL,
      baseUrl: overrides.baseUrl ?? env('OPENAI_BASE_URL') ?? OPENAI_DEFAULT_BASE_URL,
      apiKey: overrides.apiKey ?? env('OPENAI_API_KEY'),
    };
  }

  if (provider === 'ollama') {
    return {
      provider,
      model: overrides.model ?? env('OLLAMA_MODEL') ?? OLLAMA_DEFAULT_MODEL,
      baseUrl: overrides.baseUrl ?? env('OLLAMA_BASE_URL') ?? OLLAMA_DEFAULT_BASE_URL,
      // Ollama's OpenAI-compatible endpoint ignores the key but expects a header.
      apiKey: overrides.apiKey ?? 'ollama',
    };
  }

  if (provider === 'claude-code') {
    return {
      provider,
      model: overrides.model ?? env('CLAUDE_CODE_MODEL') ?? CLAUDE_CODE_DEFAULT_MODEL,
      // The CLI path is server-side configuration only: never let a request choose
      // which binary the BFF executes.
      baseUrl: env('CLAUDE_CODE_BIN') ?? CLAUDE_CODE_DEFAULT_BIN,
      apiKey: undefined,
    };
  }

  return { provider: 'mock', model: 'mock', baseUrl: '', apiKey: undefined };
}

/** Non-secret capability description for the frontend settings UI. */
export async function describeLlmConfig() {
  const claudeVersion = await detectClaudeCode(env('CLAUDE_CODE_BIN') ?? CLAUDE_CODE_DEFAULT_BIN);
  return {
    defaultProvider: pickProvider(),
    providers: {
      openai: {
        configured: openaiConfigured(),
        model: env('OPENAI_MODEL') ?? OPENAI_DEFAULT_MODEL,
        baseUrl: env('OPENAI_BASE_URL') ?? OPENAI_DEFAULT_BASE_URL,
      },
      ollama: {
        model: env('OLLAMA_MODEL') ?? OLLAMA_DEFAULT_MODEL,
        baseUrl: env('OLLAMA_BASE_URL') ?? OLLAMA_DEFAULT_BASE_URL,
      },
      'claude-code': {
        available: claudeVersion !== null,
        version: claudeVersion,
        model: env('CLAUDE_CODE_MODEL') ?? CLAUDE_CODE_DEFAULT_MODEL,
      },
      mock: { available: true },
    },
  };
}

import type { ViewSpec, ViewSpecDraft } from '@fluid/shared';

export type LlmProvider = 'openai' | 'ollama' | 'mock';

/** Fully-resolved config used to talk to a provider. */
export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
}

/** Optional per-request overrides sent by the client. */
export interface LlmConfigOverrides {
  provider?: LlmProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConceptFieldInfo {
  name: string;
  typeName: string;
  typeKind: string;
  isList?: boolean;
  isScalar?: boolean;
  description?: string | null;
}

export interface RelatedConceptInfo {
  name: string;
  fields?: string[];
}

/** Compact concept schema the frontend sends so the BFF can build prompts/mocks. */
export interface ConceptSchemaInfo {
  name: string;
  description?: string | null;
  listQuery?: string | null;
  byIdQuery?: string | null;
  fields: ConceptFieldInfo[];
  related?: RelatedConceptInfo[];
}

export interface GenerateViewInput {
  concept: string;
  schema: ConceptSchemaInfo;
  prompt: string;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateViewResult {
  spec: ViewSpec;
  draft: ViewSpecDraft;
  provider: LlmProvider;
  model: string;
}

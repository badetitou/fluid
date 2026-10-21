import type { ViewSpec, ViewSpecDraft, Widget, WidgetDraft } from '@fluid/shared';

export type LlmProvider = 'openai' | 'ollama' | 'claude-code' | 'mock';

/** Whether a view targets a concept's list or a single item (mirrors the shared ViewScope). */
export type ViewScope = 'list' | 'detail';

/** A chunk of model output streamed while a generation is in progress. */
export interface LlmDelta {
  kind: 'text' | 'thinking';
  text: string;
}
export type LlmDeltaHandler = (delta: LlmDelta) => void;

/** Fully-resolved config used to talk to a provider. */
export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  /** API base URL — or, for `claude-code`, the path of the `claude` CLI binary. */
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
  /** Rows field when the list query returns a pagination wrapper (e.g. "results"). */
  listItemsPath?: string | null;
  /** Row-limit argument of the list query (e.g. "take"), when it has one. */
  listLimitArg?: string | null;
  byIdQuery?: string | null;
  /** Key argument of the by-id query when it is not `id` (e.g. "code"). */
  byIdArgName?: string | null;
  /** GraphQL type of the by-id query's key argument (defaults to "ID!"). */
  byIdArgType?: string | null;
  fields: ConceptFieldInfo[];
  related?: RelatedConceptInfo[];
  /** Relations reachable through nested selections, several levels deep. */
  paths?: RelationPathInfo[];
  /**
   * Root query fields of the source, one per concept. Only sent for a
   * whole-graph dashboard (concept `@graph`), whose queries may start anywhere.
   */
  entryPoints?: EntryPointInfo[];
}

/** How to read one concept from the root of the graph. */
export interface EntryPointInfo {
  concept: string;
  listQuery?: string | null;
  listItemsPath?: string | null;
  listLimitArg?: string | null;
  byIdQuery?: string | null;
  byIdArgName?: string | null;
  byIdArgType?: string | null;
  /** Scalar fields of the concept, as "name: Type". */
  fields: string[];
}

/** One relation reachable from the concept, e.g. "accounts.transactions". */
export interface RelationPathInfo {
  /** Dot path of relation fields from the concept, e.g. "accounts.transactions". */
  path: string;
  typeName: string;
  /** Whether any segment of the path is a list (the path then yields many rows). */
  isList: boolean;
  /** Scalar fields of the target, as "name: Type". */
  fields: string[];
  /** The relation links a type to itself (parent/child versions, sub-folders…). */
  recursive?: boolean;
}

export interface GenerateViewInput {
  concept: string;
  schema: ConceptSchemaInfo;
  prompt: string;
  /** List or detail column the view is generated for (detail views read the by-id query). */
  scope?: ViewScope;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateViewResult {
  spec: ViewSpec;
  draft: ViewSpecDraft;
  provider: LlmProvider;
  model: string;
  reasoning?: string[];
}

export interface GenerateWidgetInput {
  concept: string;
  schema: ConceptSchemaInfo;
  prompt: string;
  /** Optional existing widget to provide context for modifications. */
  existingWidget?: Widget;
  /** Named queries available in the current view for context. */
  viewQueries?: Record<string, string>;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

export interface GenerateWidgetResult {
  widget: Widget;
  draft: WidgetDraft;
  provider: LlmProvider;
  model: string;
  reasoning?: string[];
}

import { z } from 'zod';
import {
  analyzeViewRequestSchema,
  chatItemSchema,
  chatScopeSchema,
  chatViewContextSchema,
  INSIGHT_MAX_REQUEST_CHARS,
  mutationInfoSchema,
  viewSpecSchema,
  viewWidgetInfoSchema,
  widgetSchema,
  widgetCatalogRequestSchema,
} from '@fluid/shared';

// Request body schemas for the views API. The view spec itself is validated
// with the shared zod schema so the BFF stores canonical, valid specs.

export const createViewBody = z.object({
  spec: viewSpecSchema,
  isDefault: z.boolean().optional(),
});
export type CreateViewBody = z.infer<typeof createViewBody>;

export const updateViewBody = z
  .object({
    spec: viewSpecSchema.optional(),
    title: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((v) => v.spec !== undefined || v.title !== undefined || v.isDefault !== undefined, {
    message: 'Provide at least one of: spec, title, isDefault.',
  });
export type UpdateViewBody = z.infer<typeof updateViewBody>;

/** Replaces one widget of a saved view. */
export const updateWidgetBody = z.object({ widget: widgetSchema });

/** The preferences to write: a JSON object (key → any JSON value). */
export const prefsBody = z.record(z.string(), z.json());

// -----------------------------------------------------------------------------
// LLM view generation request
// -----------------------------------------------------------------------------

/** Per-request LLM settings (provider, model, …) the frontend sends with each generation. */
const llmConfigBody = z
  .object({
    provider: z.enum(['openai', 'ollama', 'claude-code', 'mock']).optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
  })
  .optional();

const chatMessage = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const conceptSchemaInfo = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  listQuery: z.string().nullish(),
  listItemsPath: z.string().nullish(),
  listLimitArg: z.string().nullish(),
  byIdQuery: z.string().nullish(),
  byIdArgName: z.string().nullish(),
  byIdArgType: z.string().nullish(),
  fields: z.array(
    z.object({
      name: z.string(),
      typeName: z.string(),
      typeKind: z.string(),
      isList: z.boolean().optional(),
      isScalar: z.boolean().optional(),
      description: z.string().nullish(),
    }),
  ),
  possibleTypes: z.array(z.string()).optional(),
  interfaces: z.array(z.string()).optional(),
  related: z
    .array(
      z.object({
        name: z.string(),
        fields: z.array(z.string()).optional(),
        possibleTypes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  paths: z
    .array(
      z.object({
        path: z.string().min(1),
        typeName: z.string(),
        isList: z.boolean(),
        fields: z.array(z.string()),
        recursive: z.boolean().optional(),
      }),
    )
    .optional(),
  entryPoints: z
    .array(
      z.object({
        concept: z.string().min(1),
        listQuery: z.string().nullish(),
        listItemsPath: z.string().nullish(),
        listLimitArg: z.string().nullish(),
        byIdQuery: z.string().nullish(),
        byIdArgName: z.string().nullish(),
        byIdArgType: z.string().nullish(),
        fields: z.array(z.string()),
      }),
    )
    .optional(),
  mutations: z.array(mutationInfoSchema).optional(),
  mutationFields: z.array(z.string()).optional(),
});

export const generateViewBody = z.object({
  concept: z.string().min(1),
  schema: conceptSchemaInfo,
  prompt: z.string().min(1),
  scope: z.enum(['list', 'detail']).optional(),
  widgets: widgetCatalogRequestSchema.optional(),
  history: z.array(chatMessage).optional(),
  config: llmConfigBody,
});
export type GenerateViewBody = z.infer<typeof generateViewBody>;

// Widget generation request schema
export const generateWidgetBody = z.object({
  concept: z.string().min(1),
  schema: conceptSchemaInfo,
  prompt: z.string().min(1),
  existingWidget: z.unknown().optional(), // Will be validated as Widget if provided
  viewQueries: z.record(z.string(), z.string()).optional(),
  viewActions: z.record(z.string(), z.string()).optional(),
  viewWidgets: z.array(viewWidgetInfoSchema).optional(),
  widgets: widgetCatalogRequestSchema.optional(),
  history: z.array(chatMessage).optional(),
  config: llmConfigBody,
});
export type GenerateWidgetBody = z.infer<typeof generateWidgetBody>;

// Chat request: everything a view generation has, with the chat scope
// ("graph" | "view") instead of the list/detail one.
export const chatBody = generateViewBody.omit({ scope: true }).extend({
  scope: chatScopeSchema,
  view: chatViewContextSchema.optional(),
  item: chatItemSchema.optional(),
});
export type ChatBody = z.infer<typeof chatBody>;

// Insight widget: the data the view's widgets show, analysed by the LLM.
export const analyzeViewBody = analyzeViewRequestSchema
  .extend({ config: llmConfigBody })
  .refine((body) => JSON.stringify(body.sources).length <= INSIGHT_MAX_REQUEST_CHARS, {
    message: `The analysed data is larger than ${INSIGHT_MAX_REQUEST_CHARS} characters`,
    path: ['sources'],
  });

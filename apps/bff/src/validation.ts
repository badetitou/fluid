import { z } from 'zod';
import { viewSpecSchema } from '@fluid/shared';

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

// -----------------------------------------------------------------------------
// LLM view generation request
// -----------------------------------------------------------------------------

const chatMessage = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const conceptSchemaInfo = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  listQuery: z.string().nullish(),
  byIdQuery: z.string().nullish(),
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
  related: z
    .array(z.object({ name: z.string(), fields: z.array(z.string()).optional() }))
    .optional(),
});

export const generateViewBody = z.object({
  concept: z.string().min(1),
  schema: conceptSchemaInfo,
  prompt: z.string().min(1),
  history: z.array(chatMessage).optional(),
  config: z
    .object({
      provider: z.enum(['openai', 'ollama', 'mock']).optional(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
});
export type GenerateViewBody = z.infer<typeof generateViewBody>;

// Widget generation request schema
export const generateWidgetBody = z.object({
  concept: z.string().min(1),
  schema: conceptSchemaInfo,
  prompt: z.string().min(1),
  existingWidget: z.unknown().optional(), // Will be validated as Widget if provided
  viewQueries: z.record(z.string()).optional(),
  history: z.array(chatMessage).optional(),
  config: z
    .object({
      provider: z.enum(['openai', 'ollama', 'mock']).optional(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
});
export type GenerateWidgetBody = z.infer<typeof generateWidgetBody>;

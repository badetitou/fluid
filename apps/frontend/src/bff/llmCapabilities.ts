import { z } from 'zod';

/** Non-secret capabilities returned by `GET /api/llm/config`. */
export const llmCapabilitiesSchema = z.object({
  defaultProvider: z.enum(['openai', 'ollama', 'claude-code', 'mock']),
  providers: z.object({
    openai: z.object({ configured: z.boolean(), model: z.string(), baseUrl: z.string() }),
    ollama: z.object({ model: z.string(), baseUrl: z.string() }),
    'claude-code': z
      .object({ available: z.boolean(), version: z.string().nullable(), model: z.string() })
      .optional(),
    mock: z.object({ available: z.boolean() }),
  }),
});

export type LlmCapabilities = z.infer<typeof llmCapabilitiesSchema>;

export function parseLlmCapabilities(value: unknown): LlmCapabilities {
  return llmCapabilitiesSchema.parse(value);
}

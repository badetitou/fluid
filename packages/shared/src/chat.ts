import { z } from 'zod';
import { viewSpecSchema } from './view-spec';

// Contract of the LLM chat (`POST /api/llm/chat`): a conversation about the
// connected GraphQL API ("graph" scope) or about the current view ("view"
// scope). An answer is markdown text plus, when it can be shown as data, a
// small ViewSpec the frontend runs and renders inline.

export const chatScopeSchema = z.enum(['graph', 'view']);
export type ChatScope = z.infer<typeof chatScopeSchema>;

/** The column's current view, as the chat sees it (no results, just structure). */
export const chatViewContextSchema = z.object({
  title: z.string().optional(),
  queries: z.array(z.string()),
  widgets: z.array(z.object({ id: z.string(), type: z.string(), title: z.string().optional() })),
});
export type ChatViewContext = z.infer<typeof chatViewContextSchema>;

/** The item a detail column shows, when the chat is about one. */
export const chatItemSchema = z.object({ id: z.string() });
export type ChatItem = z.infer<typeof chatItemSchema>;

export const chatResponseSchema = z.object({
  /** Markdown answer. */
  message: z.string(),
  /** Data answer: queries + widgets to run and render inline. */
  view: viewSpecSchema.optional(),
  /** The conversation has enough to build a dedicated view/dashboard. */
  suggestView: z.boolean().optional(),
  provider: z.string(),
  model: z.string(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

/** What the LLM itself returns: the view is validated separately, as a view draft. */
export const chatAnswerSchema = z.object({
  message: z.string().min(1),
  view: z.unknown().optional(),
  suggestView: z.boolean().optional(),
});
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;

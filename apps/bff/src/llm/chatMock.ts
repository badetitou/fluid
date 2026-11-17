import type { ViewSpecDraft } from '@fluid/shared';
import type { ChatInput } from './chatTypes';
import { mockDraft } from './mock';

/**
 * Deterministic chat answer for the offline mock: a message, plus a table over
 * the concept's list query (or the first graph entry point) when there is one.
 */
export function mockChatDraft(input: ChatInput): { message: string; draft?: ViewSpecDraft } {
  const full = mockDraft({ ...input, scope: 'list' });
  const table = full.widgets.find((w) => w.type === 'table');
  if (!table) {
    return { message: `Mock answer to "${input.prompt}": there is no list query to show data from.` };
  }
  return {
    message: `Mock answer to "${input.prompt}": here is a table of ${input.concept}.`,
    draft: { title: full.title, queries: full.queries, widgets: [{ ...table, span: 24 }] },
  };
}

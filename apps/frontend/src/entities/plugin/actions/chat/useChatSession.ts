import { useCallback, useMemo, useState } from 'react';
import type { ChatScope, ViewSpec } from '@fluid/shared';
import { useConceptSchema, useRootConcepts, type Concept } from '../../../concept';
import { buildEntryPoints } from '../../../../llm/conceptSchema';
import {
  addAssistantTurn,
  addUserTurn,
  buildHistory,
  effectiveScope,
  lastUserPrompt,
  resetConversation,
  switchScope,
  useChatConversation,
  useLlmChat,
  viewContext,
  type ChatTurn,
} from '../../../llm';

export interface ChatTarget {
  concept: Concept;
  /** The view the column shows, if any: the "This view" scope. */
  view?: ViewSpec;
  itemId?: string;
}

/**
 * The conversation of a column's concept (kept for the browser session) and
 * the turn in flight. A failed turn stays in the conversation, with its error,
 * until it is retried.
 */
export function useChatSession({ concept, view, itemId }: ChatTarget) {
  const { conversation, update } = useChatConversation(concept.name);
  const { schema, conceptByName } = useConceptSchema(concept);
  const { queriesByType } = useRootConcepts();
  const chat = useLlmChat();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = effectiveScope(conversation.scope, view !== undefined);
  const { turns } = conversation;

  // Talking about the graph, the model needs every entry point, whatever the column.
  const graphSchema = useMemo(
    () => (scope === 'graph' && !schema.entryPoints ? { ...schema, entryPoints: buildEntryPoints(queriesByType, conceptByName) } : schema),
    [scope, schema, queriesByType, conceptByName],
  );

  const ask = useCallback(
    async (prompt: string, earlier: ChatTurn[]) => {
      setPending(true);
      setError(null);
      try {
        const answer = await chat({
          concept: concept.name,
          schema: graphSchema,
          prompt,
          scope,
          view: scope === 'view' && view ? viewContext(view) : undefined,
          item: scope === 'view' && itemId ? { id: itemId } : undefined,
          history: buildHistory(earlier),
        });
        update((c) => addAssistantTurn(c, answer));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The chat failed');
      } finally {
        setPending(false);
      }
    },
    [chat, concept.name, graphSchema, scope, view, itemId, update],
  );

  const send = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || pending) return;
      update((c) => addUserTurn(c, prompt));
      void ask(prompt, turns);
    },
    [ask, pending, turns, update],
  );

  const retry = useCallback(() => {
    const prompt = lastUserPrompt(turns);
    if (prompt && !pending) void ask(prompt, turns.slice(0, -1));
  }, [ask, pending, turns]);

  const reset = useCallback(() => {
    setError(null);
    update(resetConversation);
  }, [update]);

  const setScope = useCallback(
    (next: ChatScope) => {
      setError(null);
      update((c) => switchScope(c, next));
    },
    [update],
  );

  return { turns, scope, pending, error, send, retry, reset, setScope };
}

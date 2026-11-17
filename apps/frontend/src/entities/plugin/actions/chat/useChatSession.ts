import { useCallback, useMemo } from 'react';
import type { ChatScope, ViewSpec } from '@fluid/shared';
import { useConceptSchema, useRootConcepts, type Concept } from '../../../concept';
import { buildEntryPoints } from '../../../../llm/conceptSchema';
// Deep imports, not the `llm` index: that one pulls `useLlm`, which imports this plugin module back.
import {
  beginTurn,
  buildHistory,
  effectiveScope,
  idleEntry,
  lastUserPrompt,
  resetConversation,
  settleTurn,
  switchScope,
  viewContext,
  type ChatTurn,
} from '../../../llm/chatModel';
import { useChatEntry } from '../../../llm/chatStore';
import { useLlmChat } from '../../../llm/useLlmChat';
import { currentCatalogRequest } from '../../usePlugins';

export interface ChatTarget {
  concept: Concept;
  /** The view the column shows, if any: the "This view" scope. */
  view?: ViewSpec;
  itemId?: string;
}

/**
 * The chat of a column's concept, kept for the browser session with the turn
 * in flight and its error (so closing the drawer loses nothing). A failed turn
 * stays in the conversation until it is retried; an answer that comes after a
 * reset or a scope switch is dropped.
 */
export function useChatSession({ concept, view, itemId }: ChatTarget) {
  const { entry, change } = useChatEntry(concept.name);
  const { conversation, pending, error } = entry;
  const { schema, conceptByName } = useConceptSchema(concept);
  const { queriesByType } = useRootConcepts();
  const chat = useLlmChat();
  const hasView = view !== undefined;
  const scope = effectiveScope(conversation.scope, hasView);
  const { turns, epoch } = conversation;

  // Talking about the graph, the model needs every entry point, whatever the column.
  const graphSchema = useMemo(
    () => (scope === 'graph' && !schema.entryPoints ? { ...schema, entryPoints: buildEntryPoints(queriesByType, conceptByName) } : schema),
    [scope, schema, queriesByType, conceptByName],
  );

  const ask = useCallback(
    async (prompt: string, earlier: ChatTurn[]) => {
      try {
        const answer = await chat({
          concept: concept.name,
          schema: graphSchema,
          prompt,
          scope,
          view: scope === 'view' && view ? viewContext(view) : undefined,
          item: scope === 'view' && itemId ? { id: itemId } : undefined,
          widgets: currentCatalogRequest(),
          history: buildHistory(earlier),
        });
        change((e) => settleTurn(e, epoch, { answer }));
      } catch (err) {
        change((e) => settleTurn(e, epoch, { error: err instanceof Error ? err.message : 'The chat failed' }));
      }
    },
    [chat, concept.name, graphSchema, scope, view, itemId, epoch, change],
  );

  const send = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || pending) return;
      change((e) => beginTurn(e, prompt));
      void ask(prompt, turns);
    },
    [ask, pending, turns, change],
  );

  const retry = useCallback(() => {
    const prompt = lastUserPrompt(turns);
    if (!prompt || pending) return;
    change((e) => beginTurn(e));
    void ask(prompt, turns.slice(0, -1));
  }, [ask, pending, turns, change]);

  const reset = useCallback(() => {
    if (!pending) change((e) => idleEntry(resetConversation(e.conversation)));
  }, [pending, change]);

  const setScope = useCallback(
    (next: ChatScope) => {
      if (!pending) change((e) => idleEntry(switchScope(e.conversation, next, hasView)));
    },
    [pending, hasView, change],
  );

  return { turns, scope, pending, error, send, retry, reset, setScope };
}

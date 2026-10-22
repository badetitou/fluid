import { useState } from 'react';
import type { ViewSpec, Widget } from '@fluid/shared';
import type { ChatMessage, ConceptSchemaPayload } from '../../bff/client';
import { useLlmGenerate } from '../../entities/llm';
import { currentWidgetContracts } from '../../entities/plugin';
import { updateViewWidget, type SavedView } from '../../entities/view';
import { checkProposal, otherWidgets } from './model';

export interface WidgetTarget {
  concept: string;
  schema: ConceptSchemaPayload;
  viewId: string;
  viewSpec: ViewSpec;
  widget: Widget;
}

/** Each named query of the view, as context for the model. */
function queryTexts(spec: ViewSpec): Record<string, string> {
  return Object.fromEntries(Object.entries(spec.queries).map(([key, q]) => [key, q.query]));
}

/**
 * A conversation that rewrites one widget of a saved view with the LLM. The
 * model sees the widgets the enabled plugins provide and the other widgets of
 * the view (to wire to their outputs); the proposed widget is validated
 * against both before it can be applied.
 */
export function useWidgetAssistant({ concept, schema, viewId, viewSpec, widget }: WidgetTarget) {
  const { generateWidget } = useLlmGenerate();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ widget: Widget; reasoning: string[] } | null>(null);

  /** Resolves true when a valid widget was proposed. */
  const generate = async (prompt: string): Promise<boolean> => {
    const trimmed = prompt.trim();
    if (!trimmed) return false;
    setGenerating(true);
    setError(null);
    try {
      const contracts = currentWidgetContracts();
      const res = await generateWidget({
        concept,
        schema,
        prompt: trimmed,
        existingWidget: widget,
        viewQueries: queryTexts(viewSpec),
        viewWidgets: otherWidgets(viewSpec, widget.id, contracts),
        history,
      });
      const checked = checkProposal(res.widget, viewSpec, contracts);
      if ('error' in checked) throw new Error(checked.error);
      setProposal({ widget: checked.widget, reasoning: res.reasoning ?? [] });
      setHistory((h) => [...h, { role: 'user', content: trimmed }, { role: 'assistant', content: '(widget generated)' }]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate widget');
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const apply = async (): Promise<SavedView | null> => {
    if (!proposal) return null;
    try {
      return await updateViewWidget(viewId, widget.id, proposal.widget);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update widget');
      return null;
    }
  };

  return { generating, error, clearError: () => setError(null), proposal, generate, apply };
}

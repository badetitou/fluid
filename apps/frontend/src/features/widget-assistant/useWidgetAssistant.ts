import { useState } from 'react';
import { widgetSchema, type ViewSpec, type Widget } from '@fluid/shared';
import type { ChatMessage, ConceptSchemaPayload } from '../../bff/client';
import { useLlmGenerate } from '../../entities/llm';
import { updateViewWidget, type SavedView } from '../../entities/view';

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
 * proposed widget is validated against the widget schema before it can be applied.
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
      const res = await generateWidget({
        concept,
        schema,
        prompt: trimmed,
        existingWidget: widget,
        viewQueries: queryTexts(viewSpec),
        history,
      });
      const parsed = widgetSchema.safeParse(res.widget);
      if (!parsed.success) throw new Error(`The model returned an invalid widget: ${parsed.error.issues[0]?.message}`);
      setProposal({ widget: parsed.data, reasoning: res.reasoning ?? [] });
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
